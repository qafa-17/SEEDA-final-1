import { RoleBadge } from "@/components/role-badge";
import { FormMessage } from "@/components/form-fields";
import type { AppRole, MemberAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemberActions } from "./member-actions";

type Member = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  access: MemberAccess;
  created_at: string;
};

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Edmonton" });

/** Everyone who has joined, with access controls. Approvers only (the caller checks). */
export async function PeopleView({ meId }: { meId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_team");
  const members = (data ?? []) as Member[];

  const groups: { key: MemberAccess; title: string; empty: string }[] = [
    { key: "pending", title: "Waiting to join", empty: "Nobody is waiting." },
    { key: "active", title: "Team", empty: "No active members." },
    { key: "disabled", title: "Access removed", empty: "" },
  ];

  return (
    <>
      {error ? <FormMessage message="Couldn't load the team list. Refresh to try again." /> : null}

      <div className="space-y-8">
        {groups.map((g) => {
          const rows = members.filter((m) => m.access === g.key);
          if (g.key === "disabled" && rows.length === 0) return null;
          return (
            <section key={g.key} aria-labelledby={`team-${g.key}`}>
              <h2 id={`team-${g.key}`} className="flex items-center gap-2 font-semibold">
                {g.title}
                <span className="rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-muted">{rows.length}</span>
              </h2>
              {rows.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{g.empty}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
                  {rows.map((m) => {
                    const isMe = m.id === meId;
                    const name = m.full_name || m.email;
                    return (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {name} {isMe ? <span className="text-sm font-normal text-muted">(you)</span> : null}
                          </p>
                          <p className="truncate text-sm text-muted">{m.email}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <RoleBadge role={m.role} />
                            <span className="text-xs text-muted">Joined {dateFormat.format(new Date(m.created_at))}</span>
                          </div>
                        </div>
                        {isMe ? null : (
                          <MemberActions
                            userId={m.id}
                            name={name}
                            changes={
                              m.access === "pending"
                                ? [
                                    { kind: "access", value: "active", label: "Let in", tone: "primary" },
                                    { kind: "access", value: "disabled", label: "Decline", tone: "danger" },
                                  ]
                                : m.access === "active"
                                  ? [
                                      m.role === "publisher"
                                        ? { kind: "role", value: "approver", label: "Make approver", tone: "neutral" }
                                        : { kind: "role", value: "publisher", label: "Make publisher", tone: "neutral" },
                                      { kind: "access", value: "disabled", label: "Remove access", tone: "danger" },
                                    ]
                                  : [{ kind: "access", value: "active", label: "Restore access", tone: "neutral" }]
                            }
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
