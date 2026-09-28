import { createHash } from "node:crypto";
import type { PriorityLevel } from "@/types/database";

export interface RawTelemetryEvent {
  toolkitSlug?: string;
  source?: string;
  triggerSlug?: string;
  event_type?: string;
  userId?: string;
  metadata?: {
    uuid?: string;
    id?: string;
    toolkitSlug?: string;
    triggerSlug?: string;
    connectedAccount?: {
      userId?: string;
      authConfigId?: string;
      status?: string;
      id?: string;
    };
    triggerConfig?: Record<string, unknown>;
    triggerData?: string;
  };
  payload?: Record<string, unknown>;
  originalPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NormalizedTelemetryEvent {
  source: string;
  eventType: string;
  title: string;
  summary: string;
  priority: PriorityLevel;
  actionable: boolean;
  externalId: string;
  userIdRaw: string | null;
  rawPayload: Record<string, unknown>;
}

const CRITICAL_KEYWORDS = /\b(p0|sev0|sev1|outage|escalat|blocked|system down|production down)\b/i;
const URGENT_KEYWORDS = /\b(urgent|asap|action required|immediate|deadline today|p1|time sensitive|critical)\b/i;
const LOW_KEYWORDS = /\b(digest|newsletter|routine|automated|no-reply|noreply|weekly update)\b/i;

const MAX_PAYLOAD_BYTES = 16 * 1024; // 16KB safety ceiling for Supabase Realtime
const MAX_SUMMARY_CHARS = 1000;

/**
 * Normalizes tool slug into canonical Prism source identifier.
 */
export function normalizeSourceSlug(rawSource?: string): string {
  if (!rawSource) return "system";
  const slug = rawSource.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");

  if (slug === "outlook" || slug === "microsoft-outlook" || slug === "microsoft_outlook") {
    return "outlook";
  }
  if (slug === "teams" || slug === "microsoft-teams" || slug === "microsoft_teams") {
    return "microsoft_teams";
  }
  if (slug === "slack") {
    return "slack";
  }
  if (slug === "linear") {
    return "linear";
  }
  if (slug === "zoho" || slug === "zoho_crm" || slug === "zoho-crm") {
    return "zoho";
  }
  return slug;
}

/**
 * Formats a raw source slug into a white-labeled Prism display label.
 */
export function formatSourceLabel(source: string): string {
  switch (source) {
    case "outlook":
      return "Microsoft Outlook";
    case "microsoft_teams":
      return "Microsoft Teams";
    case "slack":
      return "Slack";
    case "linear":
      return "Linear";
    case "zoho":
      return "Zoho CRM";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

/**
 * Strips massive binary or base64 fields and bounds payload size to prevent
 * Supabase Realtime WebSocket transmission lag or truncation.
 */
export function sanitizeRawPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      // Strip potential base64 attachment data
      if (value.startsWith("data:") && value.includes(";base64,")) {
        sanitized[key] = "[base64 attachment data truncated]";
      } else if (value.length > 2000) {
        sanitized[key] = value.slice(0, 2000) + "... [truncated]";
      } else {
        sanitized[key] = value;
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 20); // Cap array items
    } else if (value !== null && typeof value === "object") {
      sanitized[key] = sanitizeRawPayload(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  const json = JSON.stringify(sanitized);
  if (Buffer.byteLength(json, "utf8") > MAX_PAYLOAD_BYTES) {
    return {
      _truncated: true,
      note: "Raw payload exceeded 16KB limit and was truncated for real-time safety.",
      partial: Object.keys(sanitized).slice(0, 10).reduce((acc, k) => {
        acc[k] = sanitized[k];
        return acc;
      }, {} as Record<string, unknown>),
    };
  }

  return sanitized;
}

/**
 * Extracts the user identifier from raw trigger payload metadata.
 * Format is typically `user_${supabaseUserId}`.
 */
export function extractUserId(event: RawTelemetryEvent): string | null {
  const directUser = event.userId;
  const metaUser = event.metadata?.connectedAccount?.userId;
  const candidate = (directUser || metaUser || "").trim();

  if (!candidate) return null;
  if (candidate.startsWith("user_")) {
    return candidate.slice(5);
  }
  return candidate;
}

/**
 * Classifies priority level based on text heuristics, tool indicators, and urgency rules.
 */
export function classifyPriority(
  text: string,
  source: string,
  extra?: { linearPriority?: number; amount?: number; isDirectMessage?: boolean }
): PriorityLevel {
  if (extra?.linearPriority === 1 || extra?.linearPriority === 0) {
    return "critical";
  }
  if (CRITICAL_KEYWORDS.test(text)) {
    return "critical";
  }
  if (extra?.linearPriority === 2 || extra?.isDirectMessage || URGENT_KEYWORDS.test(text)) {
    return "urgent";
  }
  if (extra?.amount && extra.amount >= 50000) {
    return "urgent";
  }
  if (LOW_KEYWORDS.test(text)) {
    return "low";
  }
  return "normal";
}

/**
 * Main Normalizer: converts any raw incoming event into a canonical Prism telemetry event.
 */
export function normalizeTelemetryEvent(
  raw: RawTelemetryEvent
): NormalizedTelemetryEvent {
  const rawSource = raw.toolkitSlug || raw.source || raw.metadata?.toolkitSlug || "system";
  const source = normalizeSourceSlug(rawSource);
  const eventType = raw.triggerSlug || raw.event_type || raw.metadata?.triggerSlug || "activity";
  const eventData = (raw.payload || raw.data || raw.originalPayload || {}) as Record<string, unknown>;

  let title = "";
  let summary = "";
  let externalId = "";
  let actionable = false;
  let priority: PriorityLevel = "normal";

  switch (source) {
    case "outlook": {
      const subject = (eventData.subject as string) || (eventData.title as string) || "";
      const fromObj = eventData.from as Record<string, unknown> | undefined;
      const emailAddr = (fromObj?.emailAddress as Record<string, unknown>) || {};
      const sender = (emailAddr.name as string) || (emailAddr.address as string) || (eventData.sender as string) || "";
      const bodyPreview = (eventData.bodyPreview as string) || (eventData.body as string) || (eventData.preview as string) || "";

      title = `[Outlook] ${sender ? sender + ": " : ""}${subject || "New Message"}`;
      summary = (bodyPreview || subject).slice(0, MAX_SUMMARY_CHARS);
      externalId = (eventData.id as string) || (eventData.internetMessageId as string) || "";

      const fullText = `${subject} ${bodyPreview}`;
      priority = classifyPriority(fullText, source);
      actionable = priority === "critical" || priority === "urgent" || fullText.includes("?");
      break;
    }

    case "microsoft_teams": {
      const fromObj = eventData.from as Record<string, unknown> | undefined;
      const userObj = fromObj?.user as Record<string, unknown> | undefined;
      const sender = (userObj?.displayName as string) || (eventData.sender as string) || "";
      const bodyObj = eventData.body as Record<string, unknown> | undefined;
      const content = (bodyObj?.content as string) || (eventData.message as string) || (eventData.text as string) || "";
      const channel = (eventData.channelIdentity as Record<string, unknown>)?.channelId as string | undefined;

      title = `[Teams${channel ? " #" + channel.slice(0, 10) : ""}] ${sender ? sender + ": " : ""}${content.slice(0, 60) || "New Message"}`;
      summary = content.slice(0, MAX_SUMMARY_CHARS);
      externalId = (eventData.id as string) || (eventData.messageId as string) || "";

      priority = classifyPriority(content, source);
      actionable = priority === "critical" || priority === "urgent" || content.includes("@") || content.includes("?");
      break;
    }

    case "slack": {
      const channel = (eventData.channel_name as string) || (eventData.channel as string) || "";
      const user = (eventData.user_name as string) || (eventData.user as string) || "";
      const text = (eventData.text as string) || ((eventData.message as Record<string, unknown>)?.text as string) || "";
      const isDirectMessage = Boolean(eventData.is_im || channel.startsWith("D"));

      title = `[Slack${channel ? " #" + channel : ""}] ${user ? user + ": " : ""}${text.slice(0, 60) || "New Message"}`;
      summary = text.slice(0, MAX_SUMMARY_CHARS);
      externalId = (eventData.client_msg_id as string) || (eventData.ts as string) || (eventData.event_id as string) || "";

      priority = classifyPriority(text, source, { isDirectMessage });
      actionable = isDirectMessage || priority === "critical" || priority === "urgent" || text.includes("<@") || text.includes("?");
      break;
    }

    case "linear": {
      const dataObj = (eventData.data as Record<string, unknown>) || eventData;
      const issueTitle = (dataObj.title as string) || "Issue Updated";
      const identifier = (dataObj.identifier as string) || "";
      const linearPriority = typeof dataObj.priority === "number" ? dataObj.priority : undefined;
      const action = (eventData.action as string) || "update";

      title = `[Linear] ${identifier ? identifier + ": " : ""}${issueTitle} (${action})`;
      summary = ((dataObj.description as string) || issueTitle).slice(0, MAX_SUMMARY_CHARS);
      externalId = (dataObj.id as string) || (eventData.url as string) || "";

      priority = classifyPriority(`${issueTitle} ${summary}`, source, { linearPriority });
      actionable = priority === "critical" || priority === "urgent" || action === "create";
      break;
    }

    case "zoho": {
      const moduleName = (eventData.module as string) || "Record";
      const name = (eventData.Deal_Name as string) || (eventData.Last_Name as string) || (eventData.Subject as string) || (eventData.name as string) || "";
      const amount = typeof eventData.Amount === "number" ? eventData.Amount : undefined;

      title = `[Zoho CRM ${moduleName}] ${name || "Record Updated"}`;
      summary = (eventData.Description as string || `Stage: ${eventData.Stage || 'Updated'}`).slice(0, MAX_SUMMARY_CHARS);
      externalId = (eventData.id as string) || (eventData.record_id as string) || "";

      priority = classifyPriority(`${title} ${summary}`, source, { amount });
      actionable = priority === "critical" || priority === "urgent" || (amount !== undefined && amount > 10000);
      break;
    }

    default: {
      const fallbackTitle = (eventData.title as string) || (eventData.name as string) || eventType;
      title = `[${formatSourceLabel(source)}] ${fallbackTitle}`;
      summary = JSON.stringify(eventData).slice(0, MAX_SUMMARY_CHARS);
      externalId = (eventData.id as string) || "";
      priority = classifyPriority(`${title} ${summary}`, source);
      actionable = priority === "critical" || priority === "urgent";
      break;
    }
  }

  // Fallback synthetic hash for events lacking native ID to guarantee deduplication
  if (!externalId) {
    const timestamp = (raw.metadata?.uuid || Date.now()).toString();
    externalId = createHash("sha256")
      .update(`${source}:${eventType}:${timestamp}:${title}`)
      .digest("hex");
  }

  const userIdRaw = extractUserId(raw);
  const rawPayload = sanitizeRawPayload(eventData);

  return {
    source,
    eventType,
    title,
    summary,
    priority,
    actionable,
    externalId,
    userIdRaw,
    rawPayload,
  };
}
