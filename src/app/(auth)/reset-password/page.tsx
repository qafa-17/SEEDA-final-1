import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset link in the email, which signs the user in first.
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <>
      <h1 className="font-display text-xl font-bold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">For {user.email}</p>
      <ResetPasswordForm />
    </>
  );
}
