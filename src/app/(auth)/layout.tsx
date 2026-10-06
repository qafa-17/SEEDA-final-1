import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">{children}</div>
      <p className="mt-6 text-xs text-muted">
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
      </p>
    </main>
  );
}
