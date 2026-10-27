import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "../forms";
import { ProviderButtons, OrDivider } from "../provider-buttons";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-muted">Take an article from a Google Doc to a live page, with your team. An approver lets new people in.</p>
      <ProviderButtons row />
      <OrDivider text="or sign up with email" />
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
