import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/form-fields";
import { SignInForm } from "../forms";
import { GoogleButton, OrDivider } from "../google-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <>
      <h1 className="font-display text-xl font-bold">Sign in</h1>
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
                ? "Google sign-in was cancelled. Try again, or use your email below."
                : "Couldn't reach Google sign-in. Try again in a moment, or use your email below."
            }
          />
        </div>
      ) : null}
      <GoogleButton next={next} />
      <OrDivider />
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
