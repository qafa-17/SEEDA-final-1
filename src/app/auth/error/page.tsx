import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Link didn't work" };

export default function AuthErrorPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold">That link didn&apos;t work</h1>
        <p className="mt-3 text-sm text-muted">
          Email links can only be used once and expire after an hour. Request a fresh one and use the newest email.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/login" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
            Sign in
          </Link>
          <Link href="/forgot-password" className="rounded-md border border-border px-4 py-2 font-medium hover:bg-border/40">
            Send a new reset link
          </Link>
        </div>
      </div>
    </main>
  );
}
