import { createServerClient } from "@supabase/ssr";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { hardenAuthCookie } from "@/lib/supabase/cookies";

/**
 * Server-side (per-request) Supabase client for use in Server Components,
 * Server Actions, and Route Handlers. Reads/writes the Supabase auth
 * cookies via Next's cookies() API, as required by @supabase/ssr.
 *
 * This client is still subject to RLS (it authenticates as the requesting
 * user via the anon/publishable key + their session cookies) — it is NOT
 * the admin/service-role client. Use lib/supabase/admin.ts for privileged
 * operations.
 *
 * Every auth cookie it writes is hardened (httpOnly, secure, sameSite, capped lifetime).
 */
export async function getSupabaseServerClient() {
  // Reading a session calls Date.now() (token expiry). With cacheComponents that is only allowed
  // at request time, so tell Next this work must never be prerendered or prefetched.
  await connection();

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "[Supabase Server Client] Missing NEXT_PUBLIC_SUPABASE_URL or a " +
        "publishable/anon key env var."
    );
  }

  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, hardenAuthCookie(options))
          );
        } catch {
          // Expected when called from a Server Component render (cookies
          // are read-only there). The proxy is responsible for refreshing
          // and persisting the session cookie in that case — this is not
          // a real error and must not be treated as one, but it also must
          // not silently swallow *other* failures, so we only catch here,
          // where a thrown error from `cookieStore.set` in a read-only
          // context is the one documented, expected exception.
        }
      },
    },
  });
}

