import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { RoleBadge } from "@/components/role-badge";
import { appNav } from "@/config/brand";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

// Shared frame for every workspace page. requireActiveUser() runs on the
// server: signed-out visitors go to /login, people not yet let in go to /waiting.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveUser();
  const isApprover = user.role === "approver";
  const items = appNav.filter((i) => !i.approverOnly || isApprover);

  // Approvers see how many people are waiting to be let in.
  const badges: Record<string, number> = {};
  if (isApprover) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("access", "pending");
    badges["/team"] = count ?? 0;
  }

  const displayName = user.fullName || user.email;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex flex-col border-b border-border bg-surface p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="mb-4">
          <Logo href="/board" />
        </div>
        <AppNav items={items} badges={badges} />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 md:mt-auto md:flex-col md:items-stretch">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={displayName}>
              {displayName}
            </p>
            <RoleBadge role={user.role} />
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-border/40"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
