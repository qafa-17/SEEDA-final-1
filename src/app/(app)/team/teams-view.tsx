import Link from "next/link";
import { RoleBadge } from "@/components/role-badge";
import { StatusBadge } from "@/components/status-badge";
import type { AppRole } from "@/lib/auth";
import type { ArticleStatus } from "@/lib/content/status";

export type TeamRow = {
  article_id: string;
  title: string | null;
  status: ArticleStatus;
  updated_at: string;
  member_id: string;
  full_name: string;
  member_role: AppRole;
  part: "owner" | "approved" | "published" | "reviewed" | "contributed";
  last_activity: string;
};

export const partLabels: Record<TeamRow["part"], string> = {
  owner: "Owner",
  approved: "Approved it",
  published: "Published it",
  reviewed: "Requested changes",
  contributed: "Contributed",
};

export type ArticleTeam = { id: string; title: string | null; status: ArticleStatus; members: TeamRow[] };

export function groupTeams(rows: TeamRow[]): ArticleTeam[] {
  const map = new Map<string, ArticleTeam>();
  for (const r of rows) {
    const t = map.get(r.article_id) ?? { id: r.article_id, title: r.title, status: r.status, members: [] };
    t.members.push(r);
    map.set(r.article_id, t);
  }
  return [...map.values()];
}

/** People who share at least one article with `meId`, most shared first. */
export function coworkers(teams: ArticleTeam[], meId: string) {
  const people = new Map<string, { id: string; name: string; role: AppRole; shared: number }>();
  for (const t of teams) {
    if (!t.members.some((m) => m.member_id === meId)) continue;
    for (const m of t.members) {
      if (m.member_id === meId) continue;
      const p = people.get(m.member_id) ?? { id: m.member_id, name: m.full_name || "Unnamed member", role: m.member_role, shared: 0 };
      p.shared += 1;
      people.set(m.member_id, p);
    }
  }
  return [...people.values()].sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));
}

export function TeamCards({ teams, meId }: { teams: ArticleTeam[]; meId: string }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {teams.map((t) => (
        <li key={t.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <Link href={`/articles/${t.id}`} className={`font-medium hover:underline ${t.title ? "" : "italic text-muted"}`}>
              {t.title || "Untitled draft"}
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Team on this article">
            {t.members.map((m) => (
              <li key={m.member_id} className="rounded-md border border-border px-2 py-1 text-xs">
                <span className="font-medium">
                  {m.full_name || "Unnamed member"}
                  {m.member_id === meId ? " (you)" : ""}
                </span>
                <span className="text-muted"> · {partLabels[m.part]}</span>
              </li>
            ))}
          </ul>
          {t.members.length === 1 ? <p className="mt-2 text-xs text-muted">Just one person so far.</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function CoworkerList({
  people,
  activeId,
  hrefFor,
}: {
  people: ReturnType<typeof coworkers>;
  activeId?: string;
  hrefFor: (id?: string) => string;
}) {
  if (people.length === 0) {
    return <p className="text-sm text-muted">Nobody else has worked on your articles yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((p) => {
        const active = p.id === activeId;
        return (
          <li key={p.id}>
            <Link
              href={active ? hrefFor(undefined) : hrefFor(p.id)}
              aria-current={active ? "true" : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              <span className="font-medium">{p.name}</span>
              {active ? null : <RoleBadge role={p.role} />}
              <span className={active ? "" : "text-muted"}>
                {p.shared} {p.shared === 1 ? "article" : "articles"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
