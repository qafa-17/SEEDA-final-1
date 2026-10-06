import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "publisher" | "approver";
export type MemberAccess = "pending" | "active" | "disabled";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  access: MemberAccess;
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
    .select("full_name, role, access")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
    role: (profile?.role as AppRole | undefined) ?? "publisher",
    // If the profile can't be read, treat the account as not yet approved.
    access: (profile?.access as MemberAccess | undefined) ?? "pending",
  };
});

/** Signed in (any access level). Use for pages like /waiting and /reset-password. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Signed in AND let in by an approver. Use for every workspace page and action. */
export async function requireActiveUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.access !== "active") redirect("/waiting");
  return user;
}

/** Active approver only. Others are sent to the dashboard. */
export async function requireApprover(): Promise<CurrentUser> {
  const user = await requireActiveUser();
  if (user.role !== "approver") redirect("/dashboard");
  return user;
}
