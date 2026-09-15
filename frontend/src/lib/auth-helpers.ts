/**
 * Auth Helpers — shared utility for API routes
 *
 * Provides requireAuth() which validates the Supabase session and returns the
 * authenticated user, a scoped Supabase client, and the active org ID.
 * Returns a ready-to-use 401/403 Response on failure.
 *
 * Usage in API routes:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof Response) return auth; // 401 or 403
 *   const { user, supabase, orgId } = auth;
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";
import { tenantRateLimiter, RateLimitExceededError } from "@/lib/resilience";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  /** The active organization ID (from x-active-org-id header), or null. */
  orgId: string | null;
  /** The user's email from auth */
  userEmail: string | null;
}

/**
 * Validates the Supabase session from the request cookies.
 * Returns an AuthContext on success, or a 401/403 NextResponse on failure.
 */
export async function requireAuth(
  request?: Request
): Promise<AuthContext | NextResponse> {
  let user: User | null = null;
  const supabase = await createClient();

  try {
    const { data: cookieAuth } = await supabase.auth.getUser();
    if (cookieAuth?.user) {
      user = cookieAuth.user;
    }
  } catch {
    // Cookie read failed, fallback to header
  }

  // Fallback to Authorization: Bearer <token>
  if (!user && request) {
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      const { data: tokenAuth } = await adminSupabase.auth.getUser(token);
      if (tokenAuth?.user) {
        user = tokenAuth.user;
      }
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: "not_authenticated", detail: "Valid Supabase session required" },
      { status: 401 }
    );
  }

  // ── Plan edge case #4: per-tenant rate limiting ──────────────────────────
  // Attribute each request to its tenant (active org, else user id) and
  // enforce a token bucket before the route does any work. External provider
  // fan-out is additionally limited per provider in lib/resilience.ts.
  const orgIdHeader = request
    ? (request.headers.get("x-active-org-id") || null)
    : null;
  const tenantKey = orgIdHeader || user.id;
  try {
    tenantRateLimiter.consume(tenantKey, "app-api");
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        {
          error: "rate_limited",
          detail: "Too many requests from this workspace. Please retry shortly.",
          retryAfterSeconds: err.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
    throw err;
  }

  // Extract active org from header (set by the client on every request)
  const orgId = orgIdHeader;

  // If orgId is provided, verify the user is actually a member
  if (orgId) {
    const { data: membership } = await adminSupabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "forbidden", detail: "You are not a member of this organization" },
        { status: 403 }
      );
    }
  }

  return {
    user,
    supabase,
    orgId,
    userEmail: user.email ?? null,
  };
}

/**
 * Gets the authenticated user's app_users profile (role, display_name, etc.).
 * Returns null if the row doesn't exist yet (pre-migration user).
 */
export async function getAppUserProfile(authUserId: string) {
  const { data } = await adminSupabase
    .from("app_users")
    .select("email, display_name, role, connector_preferences")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

/**
 * Ensures the app_users row exists for this Supabase Auth user.
 * Safe to call multiple times (upsert on auth_user_id).
 * The role column always gets its DEFAULT 'member' if not already set.
 */
export async function ensureAppUserByAuthId(opts: {
  authUserId: string;
  email: string;
  displayName?: string | null;
  m365UserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await adminSupabase.from("app_users").upsert(
      {
        auth_user_id: opts.authUserId,
        email: opts.email.toLowerCase(),
        display_name: opts.displayName || null,
        m365_user_id: opts.m365UserId || null,
        updated_at: new Date().toISOString(),
        // role intentionally omitted — DB DEFAULT 'member' applies on INSERT,
        // and we never downgrade an existing role on upsert.
      },
      { onConflict: "auth_user_id", ignoreDuplicates: false }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error)?.message || "upsert failed" };
  }
}

/**
 * Ensures a default "Personal Workspace" organization exists for this user.
 * Called at signup. Idempotent.
 */
export async function ensurePersonalOrg(authUserId: string, displayName: string): Promise<string | null> {
  try {
    // Check if user already has a personal org
    const { data: existing } = await adminSupabase
      .from("organizations")
      .select("id")
      .eq("owner_id", authUserId)
      .eq("type", "personal")
      .maybeSingle();

    if (existing) return existing.id;

    // Create the org
    const slug = `personal-${authUserId.slice(0, 8)}`;
    const { data: org, error: orgErr } = await adminSupabase
      .from("organizations")
      .insert({
        name: `${displayName || "Personal"}'s Workspace`,
        slug,
        owner_id: authUserId,
        type: "personal",
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("[ensurePersonalOrg] org create failed:", orgErr?.message);
      return null;
    }

    // Add user as owner member
    await adminSupabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: authUserId,
      role: "owner",
    });

    return org.id;
  } catch (err) {
    console.error("[ensurePersonalOrg] unexpected error:", err);
    return null;
  }
}
