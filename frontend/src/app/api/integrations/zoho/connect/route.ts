import { NextResponse } from "next/server";
import {
  ZOHO_PRODUCTS,
  ZOHO_PRODUCT_SCOPES,
  buildZohoAuthorizeUrl,
  zohoRedirectUri,
  type ZohoProduct,
} from "@/lib/zoho";
import { createClient } from "@/lib/supabase-server";
import { safeReturnTo } from "@/lib/http-utils";

export const dynamic = "force-dynamic";

/**
 * Zoho Multi-Tenant OAuth Initiator
 *
 * Redirects the current user to their own Zoho OAuth consent screen
 * (mirrors /api/integrations/microsoft/connect). Scopes are per product so
 * a CRM-only user never consents to Books.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("host") || "localhost:3000";
  // Only same-origin paths are accepted as the post-auth redirect target.
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "/");

  if (!process.env.ZOHO_CLIENT_ID) {
    return NextResponse.redirect(
      `${returnTo.startsWith("/") ? "" : "/"}${returnTo}?zoho_error=zoho_not_configured`
    );
  }

  // Which products to consent: explicit product param, or all three
  const productParam = (searchParams.get("product") || "").toLowerCase();
  const products: ZohoProduct[] = ZOHO_PRODUCTS.includes(productParam as ZohoProduct)
    ? [productParam as ZohoProduct]
    : ZOHO_PRODUCTS;

  const requestedScopes = searchParams.get("scopes");
  const scopes = requestedScopes
    ? Array.from(new Set(requestedScopes.split(" ").filter(Boolean)))
    : Array.from(new Set(products.flatMap((p) => ZOHO_PRODUCT_SCOPES[p])));

  // Allow explicit DC parameter from request, e.g. "in", "com", "eu", "com.au", "jp"
  const reqDc = (searchParams.get("dc") || "").trim().toLowerCase() || undefined;

  // Get authenticated user ID to embed in OAuth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  const state = Buffer.from(
    JSON.stringify({ returnTo, products, authUserId, dc: reqDc, nonce: Math.random().toString(36).slice(2) })
  ).toString("base64");

  // Bind the state to this browser session (basic CSRF protection)
  const response = NextResponse.redirect(
    buildZohoAuthorizeUrl({ products, requestHost: host, state, dc: reqDc, prompt: "consent" })
  );
  response.cookies.set("zoho_oauth_state", state, {
    httpOnly: true,
    secure: !host.includes("localhost"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  void scopes;
  void zohoRedirectUri;
  return response;
}
