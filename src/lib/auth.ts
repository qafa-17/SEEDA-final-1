import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "publisher" | "approver";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

/**
 * The signed-in user, verified on the server, or null.
 * getClaims() checks the session token's signature, so a forged cookie
 * cannot pass. cache() means it runs once per request even if several
 * components ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
    role: (profile?.role as AppRole | undefined) ?? "publisher",
  };
});

/** Use at the top of any protected page or action. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
