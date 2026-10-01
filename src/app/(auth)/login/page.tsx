import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/form-fields";
import { SignInForm } from "../forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <>
      <h1 className="font-display text-xl font-bold">Sign in</h1>
      {params.signedOut ? (
        <div className="mt-4">
          <FormMessage tone="success" message="You're signed out." />
        </div>
      ) : null}
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
