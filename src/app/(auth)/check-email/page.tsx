import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { reason } = await searchParams;
  const isReset = reason === "reset";
  return (
    <>
      <h1 className="font-display text-xl font-bold">Check your email</h1>
      <p className="mt-3 text-sm">
        {isReset
          ? "If an account exists for that address, we've sent a link to choose a new password."
          : "We've sent you a link to confirm your email address. Click it to finish creating your account. An approver will then let you in."}
      </p>
      <p className="mt-3 text-sm text-muted">
        The link works once and expires after an hour. Nothing there? Check your spam folder, or wait a few minutes and try again.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
