"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/routes";
import {
  type FormState,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "@/lib/validation/auth";

const str = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

// The site's own address, for links in emails. Next.js already rejects
// Server Action calls whose Origin doesn't match this site, and Supabase
// only accepts redirect URLs on its allow-list.
async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? "http://localhost:3000";
}

// Supabase error codes -> plain language. Unknown errors get a generic
// message so no internal detail leaks to the page.
function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Check both and try again.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link we sent.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "same_password":
      return "Choose a password different from your current one.";
    case "signup_disabled":
      return "New accounts are switched off right now. Ask the site owner.";
    default:
      return "Something went wrong on our side. Please try again.";
  }
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { fullName: str(formData, "fullName"), email: str(formData, "email"), password: str(formData, "password") };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Only full_name is sent. Role is never taken from the browser.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return { message: friendlyAuthError(error.code), values };

  // Same page whether or not the email was already registered, so nobody
  // can use this form to discover who has an account.
  redirect("/check-email?reason=signup");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: str(formData, "email"), password: str(formData, "password") };
  const values = { email: raw.email };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: friendlyAuthError(error.code), values };

  redirect(safeNextPath(str(formData, "next")));
}

// "Continue with Google". Login only asks Google for name and email (the
// default scopes); it does NOT grant access to anyone's Drive.
export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(str(formData, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Google sends people back here; /auth/confirm swaps the code for a session.
      redirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?oauth=failed");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?signedOut=1");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: str(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Only rate limits are reported; otherwise the result is identical whether
  // or not the account exists (no account discovery).
  if (error && error.code?.startsWith("over_")) return { message: friendlyAuthError(error.code), values: raw };

  redirect("/check-email?reason=reset");
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = resetPasswordSchema.safeParse({
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: friendlyAuthError(error.code) };

  redirect("/dashboard?passwordUpdated=1");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = { fullName: str(formData, "fullName") };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  // RLS also restricts this to the user's own row; the .eq is for clarity.
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { message: "Couldn't save your name. Please try again.", values: raw };

  revalidatePath("/", "layout");
  return { success: "Saved.", values: { fullName: parsed.data.fullName } };
}

export type DeleteAccountState = { message?: string };

// Permanently deletes the signed-in person's account. Works for pending
// accounts too. The database function removes only the CALLER's own
// account (it uses their session, never an id from the form) and refuses
// to remove the last active approver.
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  await requireUser();
  if (str(formData, "confirm").trim() !== "DELETE") {
    return { message: "Type DELETE in capitals to confirm." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return {
      message:
        error.hint === "last_approver"
          ? "You're the only approver. Make someone else an approver on the Team page first, so someone can still let people in."
          : "Couldn't delete your account. Please try again.",
    };
  }

  // The account is gone; clear this browser's session cookies too.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?accountDeleted=1");
}
