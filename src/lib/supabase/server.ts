import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

// Supabase client for Server Components, Server Actions and Route Handlers.
// It acts as the signed-in user (via their session cookie), so every query
// is filtered by Row Level Security exactly as that user is allowed.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't write cookies. That's fine: the proxy
          // refreshes the session cookie on every request before rendering.
        }
      },
    },
  });
}
