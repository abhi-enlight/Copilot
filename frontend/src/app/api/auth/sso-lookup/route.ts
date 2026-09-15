import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase-admin";

/**
 * Identifier-First Login — SSO Domain Lookup (plan §3, step 1)
 *
 * POST { email } → resolves the email's corporate domain against the verified
 * SSO domain registry (migration 08). When the domain belongs to a verified
 * enterprise org with SSO configured, the login screen forwards the employee
 * to the SSO endpoint instead of showing a password box.
 *
 * Public by design: the lookup happens BEFORE authentication. Only verified
 * domains and non-sensitive fields (org name, provider, tenant id) are
 * returned — never verification tokens.
 */

const EMAIL_RE = /^[^\s@]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", detail: "JSON body required" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const domain = email.split("@")[1] ?? "";
  if (!EMAIL_RE.test(email) || !domain) {
    return NextResponse.json(
      { error: "bad_request", detail: "A valid email address is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await adminSupabase
      .from("organization_sso_domains")
      .select("domain, provider, sso_tenant_id, is_verified, organizations(name, slug)")
      .eq("domain", domain)
      .maybeSingle();

    if (error) {
      console.error("[sso-lookup] query failed:", error.message);
      return NextResponse.json({ sso: null, password: true });
    }

    // Unverified domains are ignored (plan edge case #2: explicit invites only).
    if (!data || !data.is_verified) {
      return NextResponse.json({ sso: null, password: true });
    }

    const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;

    return NextResponse.json({
      sso: {
        provider: data.provider,
        tenantId: data.sso_tenant_id || "common",
        organization: {
          name: org?.name ?? null,
          slug: org?.slug ?? null,
        },
      },
      password: false,
    });
  } catch (err) {
    console.error("[sso-lookup] unexpected error:", err);
    return NextResponse.json({ sso: null, password: true });
  }
}
