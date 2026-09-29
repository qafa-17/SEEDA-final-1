import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StageNotice } from "@/components/stage-notice";

export const metadata: Metadata = { title: "Board" };

const columns = [
  { key: "draft", label: "Draft", hint: "Imported, details still being filled in" },
  { key: "in_review", label: "In Review", hint: "Waiting on the approver" },
  { key: "approved", label: "Approved", hint: "Ready to publish" },
  { key: "published", label: "Published", hint: "Live and verified" },
];

export default function BoardPage() {
  return (
    <>
      <PageHeader
        title="Board"
        description="Every Knowledge Hub article and exactly where it stands."
        action={
          <Link href="/import" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            New article from Drive
          </Link>
        }
      />
      <StageNotice stage={5}>Search, filters and live status counts appear once articles are stored in the database.</StageNotice>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((c) => (
          <section key={c.key} aria-labelledby={`col-${c.key}`} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h2 id={`col-${c.key}`} className="font-semibold">{c.label}</h2>
              <span className="text-sm text-muted">0</span>
            </div>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
            <p className="mt-6 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
              No articles yet
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
