import type { CookieOptions } from "@supabase/ssr";

const DAY = 60 * 60 * 24;
const MAX_AGE = (Number(process.env.AUTH_SESSION_MAX_AGE_DAYS) || 7) * DAY;

/**
 * Hardens every Supabase auth cookie before it is sent:
 * - httpOnly: JavaScript (and therefore XSS) can never read the session
 * - secure (production/HTTPS), sameSite=lax, path=/
 * - lifetime capped (default 7 days, AUTH_SESSION_MAX_AGE_DAYS) instead of Supabase's long default
 * Deletions (maxAge <= 0 or an expiry in the past) are passed through untouched.
 *
 * Sessions live only on the server, so the browser Supabase client is not used for auth.
 */
export function hardenAuthCookie(options: CookieOptions = {}): CookieOptions {
  const removing =
    (options.maxAge !== undefined && options.maxAge <= 0) ||
    (options.expires instanceof Date && options.expires.getTime() <= Date.now());

  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    ...(removing ? {} : { maxAge: Math.min(options.maxAge ?? MAX_AGE, MAX_AGE) }),
  };
}

