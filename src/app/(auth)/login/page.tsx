import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/form-fields";
import { SignInForm } from "../forms";
import { ProviderButtons, OrDivider } from "../provider-buttons";
import { isInApp } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const inApp = await isInApp();
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to your workspace.</p>
      {params.accountDeleted ? (
        <div className="mt-4">
          <FormMessage tone="success" message="Your account has been deleted." />
        </div>
      ) : null}
      {params.signedOut ? (
        <div className="mt-4">
          <FormMessage tone="success" message="You're signed out." />
        </div>
      ) : null}
      {params.oauth ? (
        <div className="mt-4">
          <FormMessage
            message={
              params.oauth === "cancelled"
                ? "Sign-in was cancelled. Try again, or use your email below."
                : "Couldn't reach that sign-in service. Try again in a moment, or use your email below."
            }
          />
        </div>
      ) : null}
      {inApp ? (
        <p className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
          In the app, sign in with your email and password. Google and GitHub sign-in only work in a web browser. If you joined with Google or GitHub, use &ldquo;Forgot your password?&rdquo; below once to set a password.
        </p>
      ) : (
        <>
          <ProviderButtons next={next} />
          <OrDivider />
        </>
      )}
      <SignInForm next={next} />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-2">
          Create one
        </Link>
      </p>
    </>
  );
}
