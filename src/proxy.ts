import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on pages only: skip static files, images and the favicon/icon so
  // CSS and JS always load, and the app manifest and icons can be fetched
  // before signing in (needed to install the app from the sign-in page), as
  // can the service worker and its offline page.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
