import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Idempotently ensure composio_entity_id is recorded in app_users profile
      const entityId = `user_${data.user.id}`;
      try {
        await supabase
          .from("app_users")
          .update({
            composio_entity_id: entityId,
            updated_at: new Date().toISOString(),
          })
          .eq("auth_user_id", data.user.id);
      } catch (profileErr) {
        console.warn("Notice: app_users profile update deferred:", profileErr);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with error parameter
  return NextResponse.redirect(`${origin}/auth/login?error=auth_exchange_failed`);
}
