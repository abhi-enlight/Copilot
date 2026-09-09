import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getConnectorPreferences,
  saveConnectorPreference,
  type ConnectorPreferences,
} from "@/lib/connector-preferences";
import { CONNECTOR_IDS, type ConnectorId } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

/**
 * Connector Pause Preferences API, the client-facing surface of the
 * server-side pause state.
 *
 * GET  → the current user's pause map, e.g. { "zoho.crm": false }.
 * POST → { connectorId, enabled } persists one toggle. The Connections UI
 *        calls this on every toggle so pause is enforced by the server,
 *        not just the browser.
 */

async function currentUserEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("ms_user_email")?.value || null;
}

export async function GET() {
  const email = await currentUserEmail();
  if (!email) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const preferences = await getConnectorPreferences(email);
  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  const email = await currentUserEmail();
  if (!email) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    connectorId?: string;
    enabled?: boolean;
  };
  const connectorId = (body.connectorId || "").trim() as ConnectorId;
  const enabled = body.enabled;

  if (!CONNECTOR_IDS.includes(connectorId) || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "bad_request", detail: "connectorId (known connector) and enabled (boolean) are required" },
      { status: 400 }
    );
  }

  const ok = await saveConnectorPreference(email, connectorId, enabled);
  if (!ok) {
    return NextResponse.json(
      { error: "save_failed", detail: "Couldn't save the connector preference. Please try again." },
      { status: 503 }
    );
  }

  const preferences: ConnectorPreferences = await getConnectorPreferences(email);
  return NextResponse.json({ success: true, preferences });
}
