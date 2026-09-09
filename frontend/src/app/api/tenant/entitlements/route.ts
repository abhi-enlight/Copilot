import { NextResponse } from "next/server";
import { buildEntitlementSnapshot, CONNECTOR_IDS } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

/**
 * Connector Entitlements API
 *
 * Returns the per-connector access verdict for the current session. This is
 * the post-login health check: a user who was granted CRM access (license,
 * Dataverse role, or the Admin/Owner privilege) after logging in unlocks the
 * CRM connection here, pass `?recheck=1` to bypass the probe cache and
 * re-probe the provider right now.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recheck = searchParams.get("recheck") === "1" || searchParams.get("recheck") === "true";

  try {
    const snapshot = await buildEntitlementSnapshot({ forceReprobe: recheck });
    return NextResponse.json({
      userEmail: snapshot.userEmail,
      role: snapshot.role,
      m365Authenticated: snapshot.m365Authenticated,
      connectors: snapshot.connectors,
      zoho: snapshot.zoho,
      checkedAt: snapshot.checkedAt,
      connectorIds: CONNECTOR_IDS,
    });
  } catch (err: unknown) {
    console.error("[entitlements] snapshot failed:", err);
    return NextResponse.json({ error: "entitlement_check_failed" }, { status: 500 });
  }
}

/** Explicit re-check action (used by the "Re-check access" UI button). */
export async function POST() {
  try {
    const snapshot = await buildEntitlementSnapshot({ forceReprobe: true });
    const crm = snapshot.connectors["microsoft.dynamics"];
    return NextResponse.json({
      userEmail: snapshot.userEmail,
      role: snapshot.role,
      crmAccess: crm.access,
      crmReason: crm.reason,
      connectors: snapshot.connectors,
    });
  } catch (err: unknown) {
    console.error("[entitlements] recheck failed:", err);
    return NextResponse.json({ error: "entitlement_recheck_failed" }, { status: 500 });
  }
}
