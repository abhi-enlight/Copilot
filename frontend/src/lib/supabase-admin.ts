/**
 * Admin Supabase client (Component 2c)
 *
 * Uses the SERVICE_ROLE key so it bypasses RLS entirely. Should ONLY be used
 * in server-side code (API routes, background jobs) for operations that require
 * elevated access:
 *   - Writing encrypted OAuth tokens to user_integrations
 *   - Signup-time user provisioning (ensureAppUser)
 *   - Background token refresh jobs
 *   - Admin role management
 *
 * NEVER import this in any client-side (browser) code.
 *
 * Usage:
 *   import { adminSupabase } from '@/lib/supabase-admin'
 *   const { data, error } = await adminSupabase.from('app_users').select(...)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (supabaseUrl && !serviceRoleKey && process.env.NODE_ENV === "production") {
  // Loud, intentional failure signal: silently running the "admin" client on
  // the anon key means RLS-blocked writes (app_users, user_integrations,
  // agent_audit_logs) fail at runtime with confusing permission errors.
  console.error(
    "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Admin operations (token vault writes, provisioning, audit logs) WILL FAIL. " +
      "Set SUPABASE_SERVICE_ROLE_KEY in the environment."
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && (serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

/**
 * Admin client: bypasses RLS. Server-only. Never expose to the browser.
 */
export const adminSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : createClient("https://placeholder.supabase.co", "placeholder-never-used", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

/**
 * Re-export CampaignRow for backward compatibility with existing code
 * that imported it from the old supabase.ts.
 */
export interface CampaignRow {
  id: string;
  name: string;
  client: string;
  category: string;
  reward_type: string;
  budget: string;
  code_volume: string;
  start_date: string;
  end_date: string;
  brief: string;
  status: "draft" | "live";
  tasks: any[];
  aspect_summary: any;

  // Zoho CRM, Deals module
  zoho_crm_deal_id: string | null;
  zoho_crm_deal_url: string | null;
  zoho_crm_deal_stage: string | null;

  // Zoho Projects
  zoho_project_id: string | null;
  zoho_project_url: string | null;

  // Zoho Books
  zoho_books_invoice_id: string | null;
  zoho_books_invoice_url: string | null;

  zoho_sync_status: "pending" | "partial" | "synced" | "failed";
  last_zoho_sync: string | null;

  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}
