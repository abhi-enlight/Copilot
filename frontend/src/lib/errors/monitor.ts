import type { ErrorCategory, ErrorSeverity, ClientErrorTelemetryPayload } from "./types";
import { humanizeError } from "./humanize";

// In-memory rate limiting / deduplication window
const seenErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 10000; // 10 seconds

/**
 * Strips confidential tokens, passwords, bearer keys, and sensitive queries.
 */
function sanitizeDetails(str: string): string {
  return str
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "bearer [redacted]")
    .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[redacted]")
    .replace(/password=[^&\s]+/gi, "password=[redacted]")
    .replace(/ak_[a-zA-Z0-9_\-]+/gi, "[secret_key]")
    .replace(/https?:\/\/[^\s]+@[^\s]+/gi, "[sanitized_url]");
}

/**
 * Dispatches an error event to the server telemetry pipeline.
 * Non-blocking, fault-tolerant, and sanitized.
 */
export function reportError(
  error: unknown,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    componentStack?: string;
  } = {}
): string {
  if (typeof window === "undefined") return "err_srv";

  const {
    category = "client",
    severity = "error",
    context = {},
    componentStack,
  } = options;

  const humanized = humanizeError(error, category);
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const stack = error instanceof Error ? error.stack : undefined;

  // Deduplicate rapid errors
  const dedupKey = `${category}:${rawMessage}`;
  const now = Date.now();
  const lastReported = seenErrors.get(dedupKey);

  if (lastReported && now - lastReported < DEDUP_WINDOW_MS) {
    return humanized.referenceId;
  }
  seenErrors.set(dedupKey, now);

  // Clean old deduplication entries
  if (seenErrors.size > 200) {
    for (const [k, v] of seenErrors) {
      if (now - v > DEDUP_WINDOW_MS) seenErrors.delete(k);
    }
  }

  const payload: ClientErrorTelemetryPayload = {
    referenceId: humanized.referenceId,
    message: sanitizeDetails(rawMessage.slice(0, 500)),
    category,
    severity,
    pathname: window.location.pathname,
    userAgent: navigator.userAgent.slice(0, 200),
    timestamp: new Date().toISOString(),
    componentStack: componentStack ? sanitizeDetails(componentStack.slice(0, 1000)) : undefined,
    context: {
      ...context,
      rawStack: stack ? sanitizeDetails(stack.slice(0, 1000)) : undefined,
    },
  };

  // Dispatch asynchronously via fetch with keepalive
  try {
    fetch("/api/telemetry/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Telemetry failures must never disturb user flow
    });
  } catch {
    // Ignore fetch preparation errors
  }

  // Developer mode diagnostic log
  if (process.env.NODE_ENV === "development") {
    console.debug(`[Prism Telemetry] Error recorded (${humanized.referenceId}):`, rawMessage);
  }

  return humanized.referenceId;
}

/**
 * Initializes global browser listeners for uncaught errors and unhandled rejections.
 */
export function initGlobalErrorMonitoring() {
  if (typeof window === "undefined") return;

  const handleGlobalError = (event: ErrorEvent) => {
    reportError(event.error || event.message, {
      category: "client",
      severity: "error",
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason, {
      category: "client",
      severity: "error",
      context: { type: "unhandled_promise_rejection" },
    });
  };

  window.addEventListener("error", handleGlobalError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleGlobalError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}
