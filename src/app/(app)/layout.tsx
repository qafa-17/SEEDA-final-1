import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { RoleBadge } from "@/components/role-badge";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

// Shared frame for every signed-in page. requireUser() checks the session
// on the server, so these pages can never render for a signed-out visitor.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const displayName = user.fullName || user.email;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex flex-col border-b border-border bg-surface p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-4">
          <Logo href="/board" />
        </div>
        <AppNav />
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
