import type { Metadata } from "next";
import { RefreshButton } from "@/components/refresh-button";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Waiting for approval" };

// Where signed-in people land until an approver lets them in.
export default async function WaitingPage() {
  const user = await requireUser();
  if (user.access === "active") redirect("/board");
  const disabled = user.access === "disabled";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div
          aria-hidden
          className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-xl ${
            disabled ? "bg-danger/10 text-danger" : "bg-status-review/10 text-status-review"
          }`}
        >
          {disabled ? "✕" : "⏳"}
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">
          {disabled ? "Your access has been removed" : "You're on the list"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {disabled
            ? "An approver has turned off access for this account. If you think that's a mistake, contact them directly."
            : "Your account is set up. An approver needs to let you in before you can see the workspace. Check back once they've confirmed."}
        </p>
        <p className="mt-4 text-sm">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {disabled ? null : (
            <RefreshButton className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
              Check again
            </RefreshButton>
          )}
          <form action={signOut}>
            <button type="submit" className="w-full rounded-md border border-border px-4 py-2 font-medium hover:bg-border/40">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
