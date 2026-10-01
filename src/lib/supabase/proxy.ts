import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_AFTER_SIGN_IN, isProtected, isSignedOutOnly } from "@/lib/routes";
import { getSupabaseConfig } from "./config";

/**
 * Runs before every page request:
 * 1. Refreshes the user's session cookie if it is about to expire.
 * 2. Sends signed-out visitors away from protected pages.
 * 3. Sends signed-in users away from sign-in / sign-up pages.
 * Pages ALSO check the user themselves (defence in depth), so this is not
 * the only lock on the door.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Stops CDNs caching a response that carries someone's session cookie.
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not put any code between createServerClient and getClaims():
  // getClaims() verifies the session token and triggers the refresh.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    // Carry over any refreshed session cookies.
    response.cookies.getAll().forEach((c) => target.cookies.set(c));
    return target;
  };

  if (!signedIn && isProtected(pathname)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  if (signedIn && isSignedOutOnly(pathname)) {
    return redirectTo(HOME_AFTER_SIGN_IN);
  }
  return response;
}
