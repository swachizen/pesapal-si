import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * SECURITY: this file is bundled into client components. It must NEVER
 * import or reference SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY.
 * Only the public URL and the anon/publishable key belong here.
 *
 * Prefers the new publishable-key env var, falling back to the legacy
 * anon-key var for projects that haven't migrated yet.
 */

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

function getBrowserSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "[Supabase Browser Client] Missing NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!publishableKey) {
    throw new Error(
      "[Supabase Browser Client] Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  return { supabaseUrl, publishableKey };
}

/**
 * Returns a memoized browser Supabase client. Safe to call from any client
 * component; the underlying client instance is created once per page load.
 */
export function getSupabaseBrowserClient() {
  if (clientInstance) return clientInstance;

  const { supabaseUrl, publishableKey } = getBrowserSupabaseConfig();

  clientInstance = createBrowserClient(supabaseUrl, publishableKey);
  return clientInstance;
}

