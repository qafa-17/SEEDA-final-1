import Link from "next/link";
import { Logo } from "@/components/logo";
import { ShowcasePanel } from "./showcase-panel";

// Two columns on wide screens: the form on the left, a picture of the
// product on the right. On phones and tablets, only the form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 gap-4 p-4 lg:min-h-screen lg:grid-cols-2 lg:p-5">
      <div className="flex flex-col px-2 py-6 sm:px-8 lg:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          {/* Each child fades and rises in turn (see .auth-stagger in globals.css). */}
          <div className="auth-stagger w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted">
          <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        </p>
      </div>
      <ShowcasePanel />
    </main>
  );
}
