// Which pages need a signed-in user, and which are only for signed-out visitors.
export const protectedPrefixes = ["/board", "/articles", "/import", "/keywords", "/settings", "/team", "/waiting", "/reset-password"];
export const signedOutOnlyPrefixes = ["/login", "/signup", "/forgot-password"];

export const HOME_AFTER_SIGN_IN = "/board";

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtected = (pathname: string) => protectedPrefixes.some((p) => matches(pathname, p));
export const isSignedOutOnly = (pathname: string) => signedOutOnlyPrefixes.some((p) => matches(pathname, p));

/**
 * Only allow redirects to paths on this site. Blocks "open redirect" tricks
 * such as ?next=https://evil.com, ?next=//evil.com or ?next=/\evil.com.
 */
export function safeNextPath(next: string | null | undefined, fallback = HOME_AFTER_SIGN_IN): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const parsed = new URL(next, "http://local.invalid");
    if (parsed.origin !== "http://local.invalid") return fallback;
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}
