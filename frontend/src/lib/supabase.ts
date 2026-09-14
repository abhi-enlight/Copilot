/**
 * supabase.ts — backward-compat shim
 *
 * The app has been refactored to use three focused clients:
 *   - supabase-browser.ts  → client components / hooks
 *   - supabase-server.ts   → API routes (cookie-based, RLS-enforced)
 *   - supabase-admin.ts    → service-role operations (bypass RLS)
 *
 * This file re-exports the admin client as `supabase` so that existing
 * server-side code (entitlements.ts, connector-preferences.ts, zoho.ts, etc.)
 * that imported `{ supabase }` from this file continues to work unchanged
 * during the incremental migration.
 *
 * New code should import directly from the specific client file.
 */

export { adminSupabase as supabase, isSupabaseConfigured, type CampaignRow } from "@/lib/supabase-admin";
