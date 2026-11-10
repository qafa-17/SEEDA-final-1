import { InstallAppButton } from "@/components/install-app-button";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RoleBadge } from "@/components/role-badge";
import { requireActiveUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { DeleteAccountForm } from "../../(auth)/delete-account";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireActiveUser();
  return (
    <>
      <PageHeader title="Settings" description="Your account and your role in the publishing workflow." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-muted">Your name appears on articles you own.</p>
          <div className="mt-4">
            <ProfileForm fullName={user.fullName} />
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd>
                <RoleBadge role={user.role} />
              </dd>
              <dd className="mt-1 text-xs text-muted">
                {user.role === "approver"
                  ? "You can approve and publish articles."
                  : "You can import articles and send them for review. An approver can give you approval rights."}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Password</dt>
              <dd>
                <Link href="/reset-password" className="font-medium text-primary underline underline-offset-2">
                  Change password
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section aria-labelledby="install-app" className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 id="install-app" className="font-semibold">Install the hub on your phone</h2>
        <p className="mt-1 text-sm text-muted">
          It opens full screen from your home screen, like an app. Open this site on your phone first, signed in.
        </p>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h3 className="font-medium">iPhone (Safari)</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
              <li>Tap the Share button.</li>
              <li>Tap <span className="font-medium text-foreground">Add to Home Screen</span>.</li>
              <li>Tap <span className="font-medium text-foreground">Add</span>.</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium">Android (Chrome)</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
              <li>Tap the &#8942; menu.</li>
              <li>Tap <span className="font-medium text-foreground">Install app</span> (or Add to Home screen).</li>
              <li>Tap <span className="font-medium text-foreground">Install</span>.</li>
            </ol>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">On a computer, Chrome and Edge show an install button at the right end of the address bar.</p>
        <InstallAppButton />
      </section>
      <section aria-labelledby="danger-zone" className="mt-6 rounded-lg border border-danger/30 bg-surface p-5">
        <h2 id="danger-zone" className="font-semibold text-danger">Delete account</h2>
        <div className="mt-3">
          <DeleteAccountForm />
        </div>
      </section>
    </>
  );
}
