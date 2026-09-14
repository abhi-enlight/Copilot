/**
 * Browser-side Supabase client (Component 2a)
 *
 * Uses @supabase/ssr createBrowserClient so the auth session is stored in
 * cookies and survives Next.js server-side rendering without hydration mismatches.
 *
 * Usage: import { createClient } from '@/lib/supabase-browser'
 *        const supabase = createClient()
 *        const { data: { user } } = await supabase.auth.getUser()
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
