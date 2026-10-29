import Link from "next/link";
import { PiLightbulbBold } from "react-icons/pi";
import { PLANNED } from "@/lib/drafts/style";
import { regionBySlug } from "@/lib/ideas/regions";

/** The owner's planned articles, each one click from its research. */
export function PlannedArticles() {
  return (
    <section aria-labelledby="planned" className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-5">
      <h2 id="planned" className="flex items-center gap-2 font-semibold">
        <PiLightbulbBold aria-hidden className="text-accent" /> Planned by the owner
      </h2>
      <p className="mt-1 text-sm text-muted">
        From EPCMst&apos;s website analysis. Research the keyword, then choose &ldquo;Suggest headlines&rdquo;: the planned headline is offered first.
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {PLANNED.map((p) => (
          <li key={p.keyword} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="font-display font-semibold">{p.title}</p>
              <p className="mt-1 text-sm text-muted">{p.angle}</p>
              <p className="mt-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{p.keyword}</span>
                <span className="ml-2 text-muted">{regionBySlug(p.region)?.label}</span>
              </p>
            </div>
            <Link
              href={`/ideas?${new URLSearchParams({ keyword: p.keyword, region: p.region })}`}
              className="self-start rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40"
            >
              Fill in the research form
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
