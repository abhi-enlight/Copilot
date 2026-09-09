/**
 * Server-only helpers shared by the OAuth callback and the entitlements engine.
 *
 * Lives apart from lib/entitlements.ts because the callback runs *before* the
 * session cookies exist, it must be able to construct a synthetic session and
 * to upsert the app user row directly.
 */

import { supabase } from "@/lib/supabase";
import { probeDynamicsCrmAccess, type MicrosoftSession } from "@/lib/entitlements";

export { probeDynamicsCrmAccess };
export type { MicrosoftSession };

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

/**
 * Upserts the app_users row for a Microsoft-authenticated user. The stored
 * role persists across logins, this is how an admin privilege granted after
 * login unlocks the CRM connection on the next entitlement re-check.
 */
export async function ensureAppUser(opts: {
  email: string;
  displayName: string | null;
  m365UserId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !opts.email) return { ok: false, error: "not_configured" };
  try {
    const { error } = await supabase
      .from("app_users")
      .upsert(
        {
          email: opts.email.toLowerCase(),
          display_name: opts.displayName,
          m365_user_id: opts.m365UserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email", ignoreDuplicates: false }
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error)?.message || "upsert failed" };
  }
}
