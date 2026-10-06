import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <h1 className="font-display text-xl font-bold">Article not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been deleted, or the link is wrong.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        Back to the dashboard
      </Link>
    </div>
  );
}
