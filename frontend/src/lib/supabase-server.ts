/**
 * Server-side Supabase client (Component 2b)
 *
 * Uses @supabase/ssr createServerClient so it can read/write cookies from the
 * Next.js request context. Runs as the authenticated user (anon key + JWT from
 * cookie), so RLS is enforced automatically.
 *
 * Usage in API routes / Server Components:
 *   import { createClient } from '@/lib/supabase-server'
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies are read-only.
            // Middleware handles cookie mutations; this is safe to ignore here.
          }
        },
      },
    }
  );
}
