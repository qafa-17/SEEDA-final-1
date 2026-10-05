import Link from "next/link";
import { pageList } from "@/lib/pagination";

const box = "min-w-9 rounded-md border px-3 py-1.5 text-center text-sm font-medium";

/** Previous / numbered pages / Next. Any page is one click away. */
export function Pagination({ current, last, hrefFor }: { current: number; last: number; hrefFor: (page: number) => string }) {
  if (last <= 1) return null;
  const off = `${box} border-border text-muted opacity-50`;
  const on = `${box} border-border bg-surface hover:bg-border/40`;
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      {current > 1 ? <Link href={hrefFor(current - 1)} className={on}>Previous</Link> : <span className={off} aria-disabled="true">Previous</span>}
      {pageList(current, last).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>…</span>
        ) : p === current ? (
          <span key={p} aria-current="page" className={`${box} border-primary bg-primary text-primary-foreground`}>
            <span className="sr-only">Page </span>{p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={on} aria-label={`Page ${p}`}>{p}</Link>
        ),
      )}
      {current < last ? <Link href={hrefFor(current + 1)} className={on}>Next</Link> : <span className={off} aria-disabled="true">Next</span>}
    </nav>
  );
}
