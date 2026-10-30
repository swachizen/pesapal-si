import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the secret/service-role key. Bypasses
 * RLS entirely. This is the ONLY place in the codebase that may reference
 * SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY.
 *
 * `import "server-only"` makes any attempt to import this module from a
 * Client Component fail at build time rather than silently bundling a
 * service key into client JavaScript.
 *
 * Deliberately NOT instantiated at module scope: some deployment/build
 * environments evaluate route modules without the full server env
 * available (e.g. certain static-analysis or edge-compatible build
 * passes), and a module-scope `createClient()` call would throw at import
 * time rather than at actual use time. `getSupabaseAdminClient()` is a
 * factory — call it inside the request/server-action body that needs it.
 */

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("[Supabase Admin Client] Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!secretKey) {
    throw new Error(
      "[Supabase Admin Client] Missing SUPABASE_SECRET_KEY " +
        "(or the legacy SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  cachedAdminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdminClient;
}

