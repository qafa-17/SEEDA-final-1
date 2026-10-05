import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { FormMessage } from "@/components/form-fields";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch } from "@/lib/content/board-query";
import { PeopleView } from "./people-view";
import { CoworkerList, TeamCards, coworkers, groupTeams, type TeamRow } from "./teams-view";

export const metadata: Metadata = { title: "Team" };

const PER_PAGE = 20;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const me = await requireActiveUser();
  const isApprover = me.role === "approver";
  const sp = await searchParams;

  // Publishers only ever get "mine"; the database applies the same rule.
  const requested = z.enum(["mine", "all", "people"]).catch("mine").parse(first(sp.view) ?? "mine");
  const view = isApprover ? requested : "mine";
  const person = z.uuid().optional().catch(undefined).parse(first(sp.person) || undefined);
  const q = cleanSearch(first(sp.q) ?? "");
  const page = z.coerce.number().int().min(1).max(1000).catch(1).parse(first(sp.page) ?? 1);

  const href = (change: Record<string, string | number | undefined>) => {
    const merged: Record<string, string | number | undefined> = { view, person, q, page: undefined, ...change };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "view" && v === "mine")) p.set(k, String(v));
    const s = p.toString();
    return s ? `/team?${s}` : "/team";
  };

  const tabs = [
    { key: "mine", label: "My teams", show: true },
    { key: "all", label: "All teams", show: isApprover },
    { key: "people", label: "Everyone who joined", show: isApprover },
  ].filter((t) => t.show);

  let body: React.ReactNode;

  if (view === "people") {
    body = <PeopleView meId={me.id} />;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("article_teams");
    const allTeams = groupTeams((data ?? []) as TeamRow[]);
    const myTeams = allTeams.filter((t) => t.members.some((m) => m.member_id === me.id));
    const people = coworkers(allTeams, me.id);

    let teams = view === "mine" ? myTeams : allTeams;
    if (person) teams = teams.filter((t) => t.members.some((m) => m.member_id === person));
    if (q) teams = teams.filter((t) => (t.title ?? "").toLowerCase().includes(q.toLowerCase()));
    const pages = Math.max(1, Math.ceil(teams.length / PER_PAGE));
    const shown = teams.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // Everyone who appears on any visible team, for the approver's person filter.
    const everyone = [...new Map(allTeams.flatMap((t) => t.members).map((m) => [m.member_id, m.full_name || "Unnamed member"])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]));

    body = (
      <>
        {error ? <FormMessage message="Couldn't load teams. Refresh to try again." /> : null}

        {view === "mine" ? (
          <section aria-labelledby="coworkers" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="coworkers" className="font-semibold">People you work with</h2>
            <p className="mt-1 text-sm text-muted">Everyone who has worked on an article with you. Pick someone to see only the articles you share.</p>
            <div className="mt-3">
              <CoworkerList people={people} activeId={person} hrefFor={(id) => href({ person: id })} />
            </div>
          </section>
        ) : (
          <form method="get" action="/team" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <input type="hidden" name="view" value="all" />
            <div className="min-w-48 flex-1">
              <label htmlFor="q" className="block text-xs font-medium text-muted">Article title</label>
              <input id="q" name="q" type="search" defaultValue={q} maxLength={100} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="person" className="block text-xs font-medium text-muted">Person</label>
              <select id="person" name="person" defaultValue={person ?? ""} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Anyone</option>
                {everyone.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Filter</button>
            {q || person ? <Link href="/team?view=all" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">Clear</Link> : null}
          </form>
        )}

        <h2 className="mt-8 font-semibold">
          {view === "mine" ? "Your article teams" : "Every article team"}{" "}
          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-muted">{teams.length}</span>
        </h2>

        <div className="mt-3">
          {shown.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              {view === "mine" && myTeams.length === 0
                ? "You're not on any article teams yet. Import an article, or review one, and its team appears here."
                : "No teams match."}
            </p>
          ) : (
            <TeamCards teams={shown} meId={me.id} />
          )}
        </div>

        <Pagination current={page} last={pages} hrefFor={(n) => href({ page: n })} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Team"
        description={isApprover ? "Who works on what, and who has access." : "The people you work with, article by article."}
      />
      {tabs.length > 1 ? (
        <nav aria-label="Team views" className="mb-6 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "mine" ? "/team" : `/team?view=${t.key}`}
              aria-current={view === t.key ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                view === t.key ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {body}
    </>
  );
}
