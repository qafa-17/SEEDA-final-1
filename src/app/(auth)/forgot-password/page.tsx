import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-xl font-bold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
