import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteZohoIntegration, ZOHO_PRODUCTS, type ZohoProduct } from "@/lib/zoho";

export const dynamic = "force-dynamic";

/** Clears the current user's stored Zoho connection (one product or all). */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const msUserEmail = cookieStore.get("ms_user_email")?.value || null;
  const zohoUserEmail = cookieStore.get("zoho_user_email")?.value || null;

  let product: ZohoProduct | undefined;
  let bodyUserEmail: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as { product?: string; userEmail?: string };
    if (body.product && ZOHO_PRODUCTS.includes(body.product as ZohoProduct)) {
      product = body.product as ZohoProduct;
    }
    if (body.userEmail && typeof body.userEmail === "string") {
      bodyUserEmail = body.userEmail;
    }
  } catch {
    // no body, disconnect everything
  }

  const { requireAuth } = await import("@/lib/auth-helpers");
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const targetKeys = Array.from(
    new Set([user.id, `auth:${user.id}`, user.email].filter(Boolean) as string[])
  );

  try {
    for (const key of targetKeys) {
      await deleteZohoIntegration(key, product);
    }

    const response = NextResponse.json({ success: true, product: product || "all" });
    response.cookies.set("zoho_user_email", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err: unknown) {
    console.error("[zoho-disconnect] failed:", err);
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }
}
