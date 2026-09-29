import type { HumanizedError } from "./types";

/**
 * Universal error humanization engine.
 * Converts raw developer errors, HTTP statuses, database exceptions,
 * and SDK failures into friendly, empathetic, non-technical plain English explanations.
 */
export function humanizeError(
  error: unknown,
  context?: string
): HumanizedError {
  const referenceId = `ref_${Math.random().toString(36).substring(2, 9)}`;

  // Extract raw error string safely
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    message = String(obj.message || obj.detail || obj.error || "");
  }

  const normalized = message.toLowerCase();

  // 1. Network & Offline drops
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("econnrefused") ||
    normalized.includes("offline") ||
    normalized.includes("net::err_") ||
    normalized.includes("load failed")
  ) {
    return {
      title: "Connection Interrupted",
      description:
        "We're having trouble connecting to the network. Please check your internet connection and try again.",
      actionLabel: "Try Again",
      actionType: "retry",
      referenceId,
      isRetryable: true,
    };
  }

  // 2. Authentication & Session Expiry
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("jwt expired") ||
    normalized.includes("session expired") ||
    normalized.includes("auth session missing") ||
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid_credentials")
  ) {
    if (
      normalized.includes("invalid login credentials") ||
      normalized.includes("invalid_credentials")
    ) {
      return {
        title: "Sign-in Details Incorrect",
        description:
          "The email or password entered does not match our records. Please double-check and try again.",
        actionLabel: "Try Again",
        actionType: "retry",
        referenceId,
        isRetryable: true,
      };
    }

    if (normalized.includes("email not confirmed")) {
      return {
        title: "Email Verification Required",
        description:
          "Please check your inbox and click the verification link to activate your account.",
        actionLabel: "Resend Link",
        actionType: "retry",
        referenceId,
        isRetryable: false,
      };
    }

    if (normalized.includes("already registered") || normalized.includes("user already exists")) {
      return {
        title: "Account Already Exists",
        description:
          "An account with this email is already registered. Please sign in instead.",
        actionLabel: "Sign In",
        actionUrl: "/auth/login",
        actionType: "navigate",
        referenceId,
        isRetryable: false,
      };
    }

    return {
      title: "Session Expired",
      description:
        "Your sign-in session has timed out. Please sign in again to keep working with your tools.",
      actionLabel: "Sign In",
      actionUrl: "/auth/login",
      actionType: "navigate",
      referenceId,
      isRetryable: false,
    };
  }

  // 3. Rate Limiting & Overload
  if (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return {
      title: "Momentary Pause",
      description:
        "Things are moving a bit fast! Please wait a few seconds and try again.",
      actionLabel: "Try Again",
      actionType: "retry",
      referenceId,
      isRetryable: true,
    };
  }

  // 4. Permissions & Access Control
  if (
    normalized.includes("403") ||
    normalized.includes("forbidden") ||
    normalized.includes("permission denied") ||
    normalized.includes("violates row-level") ||
    normalized.includes("not authorized")
  ) {
    return {
      title: "Access Restricted",
      description:
        "You don't have permission to perform this action. Please check with your workspace administrator.",
      referenceId,
      isRetryable: false,
    };
  }

  // 5. Speech & Voice Recognition
  if (context === "speech" || normalized.includes("speech") || normalized.includes("microphone")) {
    if (normalized.includes("not-allowed") || normalized.includes("denied")) {
      return {
        title: "Microphone Access Needed",
        description:
          "Please allow microphone access in your browser address bar settings to use voice input.",
        referenceId,
        isRetryable: false,
      };
    }
    if (normalized.includes("not supported") || normalized.includes("unsupported")) {
      return {
        title: "Voice Input Unavailable",
        description:
          "Voice speech recognition is not supported in this browser. You can type your request directly in the prompt bar.",
        referenceId,
        isRetryable: false,
      };
    }
    return {
      title: "Audio Not Detected",
      description:
        "We couldn't hear any speech. Check that your microphone is working and speak clearly.",
      actionLabel: "Try Again",
      actionType: "retry",
      referenceId,
      isRetryable: true,
    };
  }

  // 6. Tool / Integration Connections
  if (
    context === "integration" ||
    normalized.includes("composio") ||
    normalized.includes("socket hang up") ||
    normalized.includes("connection cancelled") ||
    normalized.includes("connect failed") ||
    normalized.includes("failed to disconnect")
  ) {
    if (normalized.includes("cancelled") || normalized.includes("canceled") || normalized.includes("closed")) {
      return {
        title: "Connection Window Closed",
        description:
          "The tool sign-in window was closed before authorization was completed.",
        actionLabel: "Reconnect",
        actionType: "retry",
        referenceId,
        isRetryable: true,
      };
    }

    return {
      title: "Tool Connection Issue",
      description:
        "We had trouble communicating with the connected service. Please check your connection in the Connect Hub or try again in a moment.",
      actionLabel: "Open Connect Hub",
      actionUrl: "/integrations",
      actionType: "navigate",
      referenceId,
      isRetryable: true,
    };
  }

  // 7. Operational Agent & Streaming
  if (
    context === "agent" ||
    normalized.includes("agent runtime") ||
    normalized.includes("streaming error") ||
    normalized.includes("aborted")
  ) {
    if (normalized.includes("aborted") || normalized.includes("cancelled")) {
      return {
        title: "Request Stopped",
        description: "Generation was cancelled.",
        referenceId,
        isRetryable: false,
      };
    }

    if (
      normalized.includes("no llm") ||
      (normalized.includes("api key") && !normalized.includes("valid")) ||
      (normalized.includes("model") && normalized.includes("not found"))
    ) {
      return {
        title: "AI Model Service Unavailable",
        description:
          "The AI language model is temporarily unreachable or misconfigured. Please check your API key in environment settings.",
        referenceId,
        isRetryable: false,
      };
    }

    return {
      title: "Assistant Temporarily Paused",
      description:
        "The assistant encountered a brief pause while preparing your response. Your session is intact. Please try asking again.",
      actionLabel: "Try Again",
      actionType: "retry",
      referenceId,
      isRetryable: true,
    };
  }

  // 8. Action proposal approval / rejection execution
  if (context === "action") {
    return {
      title: "Action Could Not Complete",
      description:
        "The connected tool was unable to execute this request right now. Please verify your tool's status in Connect Hub and try again.",
      actionLabel: "Check Status",
      actionUrl: "/integrations",
      actionType: "navigate",
      referenceId,
      isRetryable: true,
    };
  }

  // 9. Generic safe fallback
  return {
    title: "Something Went Wrong",
    description:
      "We encountered an unexpected hiccup on our end. Your data is completely safe, and we have noted this issue.",
    actionLabel: "Try Again",
    actionType: "retry",
    referenceId,
    isRetryable: true,
  };
}
