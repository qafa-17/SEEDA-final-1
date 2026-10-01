import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "../forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">New accounts start as a publisher. An admin can make you an approver.</p>
      <SignUpForm />
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
