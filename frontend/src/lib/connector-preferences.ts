// =============================================================================
// Connector Preferences, server-side pause state (the pause source of truth)
//
// A connector's pause toggle used to live only in localStorage; anything that
// didn't read the browser (the n8n agent, campaign writes) could still touch a
// paused connector. Preferences are now stored on the app_users row
// (app_users.connector_preferences JSONB, migration 04) and enforced
// server-side in /api/chat, /api/campaigns, /api/ai/intent and every service
// workflow via the connectorContext payload.
// =============================================================================

import { supabase } from "@/lib/supabase";
import { CONNECTOR_IDS, type ConnectorId } from "@/lib/entitlements";

export type ConnectorPreferences = Partial<Record<ConnectorId, boolean>>;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

function normalizePrefs(raw: unknown): ConnectorPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ConnectorPreferences = {};
  for (const id of CONNECTOR_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === "boolean") out[id] = v;
  }
  return out;
}

/** True when the user explicitly paused this connector. */
export function isConnectorPaused(prefs: ConnectorPreferences, id: ConnectorId): boolean {
  return prefs[id] === false;
}

/** Reads the user's pause map. Missing column / unconfigured Supabase → empty map. */
export async function getConnectorPreferences(email: string | null | undefined): Promise<ConnectorPreferences> {
  if (!email || !isSupabaseConfigured()) return {};
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("connector_preferences")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error || !data) return {};
    return normalizePrefs(data.connector_preferences);
  } catch {
    return {};
  }
}

/**
 * Upserts one connector's paused flag for the user (creates the app_users row
 * if needed). Returns false on failure so callers can roll back optimistic UI.
 */
export async function saveConnectorPreference(
  email: string,
  id: ConnectorId,
  enabled: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const current = await getConnectorPreferences(email);
    const next: ConnectorPreferences = { ...current, [id]: enabled };

    // upsert needs a stable conflict target; ensure the row exists first
    const { error: upsertErr } = await supabase
      .from("app_users")
      .upsert(
        { email: email.toLowerCase(), connector_preferences: next, updated_at: new Date().toISOString() },
        { onConflict: "email", ignoreDuplicates: false }
      );
    if (upsertErr) {
      console.error("[connector-preferences] upsert failed:", upsertErr.message, upsertErr.code, upsertErr.details);
    }
    return !upsertErr;
  } catch (err) {
    console.error("[connector-preferences] unexpected error:", err);
    return false;
  }
}
