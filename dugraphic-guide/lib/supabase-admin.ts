import { createClient } from "@supabase/supabase-js";

// Server-only client using the Supabase service role key. Never import this
// file from a Client Component — the key must not reach the browser bundle.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
