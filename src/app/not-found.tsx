import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-border/40">
          Home
        </Link>
        <Link href="/board" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
          Go to the board
        </Link>
      </div>
    </main>
  );
}
