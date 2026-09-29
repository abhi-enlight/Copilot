export type ErrorSeverity = "info" | "warning" | "error" | "fatal";

export type ErrorCategory =
  | "network"
  | "auth"
  | "agent"
  | "tool"
  | "server"
  | "client"
  | "speech";

export interface HumanizedError {
  /** Short, calm headline for users (e.g. "Connection Interrupted") */
  title: string;
  /** Non-technical, empathetic plain-English explanation */
  description: string;
  /** Suggested label for recovery action (e.g. "Try Again", "Open Connect Hub") */
  actionLabel?: string;
  /** Destination URL if action requires navigation */
  actionUrl?: string;
  /** Recovery action type */
  actionType?: "retry" | "refresh" | "navigate" | "dismiss";
  /** An opaque support reference ID (e.g. "err_9b2d8f") for diagnostic lookup */
  referenceId: string;
  /** Whether the error is transient and can be retried */
  isRetryable: boolean;
}

export interface ClientErrorTelemetryPayload {
  referenceId: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  pathname: string;
  userAgent?: string;
  timestamp: string;
  componentStack?: string;
  context?: Record<string, unknown>;
}
