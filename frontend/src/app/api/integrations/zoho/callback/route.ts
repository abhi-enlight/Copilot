import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ZOHO_PRODUCTS,
  ZOHO_PRODUCT_SCOPES,
  exchangeZohoCode,
  probeZohoProduct,
  upsertZohoIntegration,
  zohoDataCenter,
  type ZohoProduct,
} from "@/lib/zoho";
import { adminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { safeReturnTo } from "@/lib/http-utils";

export const dynamic = "force-dynamic";

/**
 * Zoho OAuth Callback
 *
 * Exchanges the authorization code, probes each requested product to verify
 * real access AND discover the user's own org IDs / data center (replacing
 * the legacy hard-coded `60085935707` / `60085935698` / `zoho.in`), and
 * stores encrypted tokens per user in the user_integrations vault.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("host") || "localhost:3000";
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const rawState = searchParams.get("state");

  let returnTo = "/";
  let products: ZohoProduct[] = [...ZOHO_PRODUCTS];
  let authUserId: string | null = null;
  let stateDc: string | undefined = undefined;

  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, "base64").toString("utf-8"));
      returnTo = safeReturnTo(decoded.returnTo, returnTo);
      authUserId = decoded.authUserId || null;
      if (decoded.dc && typeof decoded.dc === "string") {
        stateDc = decoded.dc.trim().toLowerCase();
      }
      if (Array.isArray(decoded.products) && decoded.products.length) {
        products = decoded.products.filter((p: string) => ZOHO_PRODUCTS.includes(p as ZohoProduct));
      }
    } catch {
      // keep defaults
    }
  }

  const baseUrl = `${host.includes("localhost") ? "http" : "https"}://${host}`;

  if (error) {
    console.error("[zoho-callback] OAuth error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(`${baseUrl}${returnTo}?zoho_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?zoho_error=missing_code`);
  }

  // CSRF: state must match the cookie issued at connect time. The check is
  // mandatory — a missing cookie means the flow wasn't initiated by this app.
  const cookieStore = await cookies();
  const issuedState = cookieStore.get("zoho_oauth_state")?.value || "";
  if (!issuedState || !rawState || issuedState !== rawState) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?zoho_error=state_mismatch`);
  }

  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?zoho_error=zoho_not_configured`);
  }

  const tokenSet = await exchangeZohoCode(code, host, stateDc);
  if (!tokenSet.accessToken) {
    console.error("[zoho-callback] token exchange failed:", tokenSet.error);
    return NextResponse.redirect(`${baseUrl}${returnTo}?zoho_error=token_exchange_failed`);
  }

  // Identify the Zoho user (email) via the CRM Users API when CRM scope was
  // granted; fall back to the OAuth state marker otherwise.
  let zohoEmail: string | null = null;
  const dc = tokenSet.detectedDc || stateDc || zohoDataCenter();
  const crmProbe = products.includes("crm")
    ? await probeZohoProduct("crm", tokenSet.accessToken, dc)
    : { ok: false, detail: "not requested" };
  if (crmProbe.zohoUserId) {
    try {
      const meRes = await fetch(`${`https://www.zohoapis.${dc}`}/crm/v2/users?type=CurrentUser`, {
        headers: { Authorization: `Zoho-oauthtoken ${tokenSet.accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      if (meRes.ok) {
        const me = await meRes.json();
        zohoEmail = me?.users?.[0]?.email || null;
      }
    } catch {
      zohoEmail = null;
    }
  }

  // Which products did the user actually consent to (scope echo)?
  const grantedScopeStr = searchParams.get("scope") || "";
  const effectiveProducts = products.filter((p) => {
    if (!grantedScopeStr) return true; // Zoho does not always echo scope, probe anyway
    return ZOHO_PRODUCT_SCOPES[p].some((s) => grantedScopeStr.includes(s));
  }) as ZohoProduct[];

  const results: Record<string, { ok: boolean; detail: string }> = {};

  // Resolve identity STRICTLY from authenticated sources:
  // 1. the Supabase session user, 2. the Zoho user's own email via the CRM
  // Users API. The ms_user_email cookie is client-editable and must never
  // decide whose vault receives OAuth tokens.
  const session = await (async () => {
    try {
      const sb = await createClient();
      const { data } = await sb.auth.getUser();
      return data.user ?? null;
    } catch {
      return null;
    }
  })();
  const effectiveEmail = session?.email || zohoEmail || (session ? `auth:${session.id}` : null);

  for (const product of effectiveProducts) {
    const probe =
      product === "crm" && crmProbe.ok
        ? crmProbe
        : await probeZohoProduct(product, tokenSet.accessToken, dc);
    results[product] = { ok: probe.ok, detail: probe.detail };

    if (!effectiveEmail) {
      console.error("[zoho-callback] no identity available, skipping token store for", product);
      results[product] = { ok: false, detail: "no_identity" };
      continue;
    }

    const stored = await upsertZohoIntegration({
      userEmail: effectiveEmail,
      product,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      scopes: ZOHO_PRODUCT_SCOPES[product],
      probe,
      expiresAt: tokenSet.expiresIn ? Date.now() + tokenSet.expiresIn * 1000 : null,
    });
    if (!stored.ok) {
      results[product] = { ok: false, detail: stored.error || "token store failed" };
    }

    // Link the vault row to the authenticated Supabase user id (never the
    // client-decoded state value alone — session identity is authoritative).
    const linkUserId = session?.id || authUserId;
    if (linkUserId && stored.ok) {
      await adminSupabase
        .from("user_integrations")
        .update({ auth_user_id: linkUserId })
        .eq("user_email", effectiveEmail)
        .eq("provider", "zoho")
        .eq("product", product)
        .is("auth_user_id", null);
    }
  }

  const redirectUrl = new URL(returnTo, baseUrl);
  redirectUrl.searchParams.set("connected", "zoho");
  for (const [product, res] of Object.entries(results)) {
    redirectUrl.searchParams.set(`zoho_${product}`, res.ok ? "1" : "0");
  }
  const response = NextResponse.redirect(redirectUrl.toString());
  response.cookies.set("zoho_oauth_state", "", { path: "/", maxAge: 0 });
  const finalEmail = session?.email || zohoEmail || "default_user";
  response.cookies.set("zoho_user_email", finalEmail, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: !host.includes("localhost"),
  });
  return response;
}
