import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FormMessage } from "@/components/form-fields";
import { RefreshButton } from "@/components/refresh-button";
import { StatusBadge } from "@/components/status-badge";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { driveErrorMessage, isDriveConfigured, listFolderDocs, type DriveDoc } from "@/lib/drive";
import { requestNow, timeAgo, type ArticleStatus } from "@/lib/content/status";
import { ImportButton } from "./import-button";

export const metadata: Metadata = { title: "Import from Drive" };

type Imported = { id: string; drive_file_id: string; status: ArticleStatus; drive_modified_at: string | null };

export default async function ImportPage() {
  const user = await requireActiveUser();
  const header = <PageHeader title="Import from Drive" description="Finished Google Docs in the shared Knowledge Hub folder. Importing reads the Doc; it never changes it." />;

  if (!isDriveConfigured()) {
    return (
      <>
        {header}
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">Google Drive isn&apos;t connected yet</p>
          <p className="mt-1 text-sm text-muted">
            {user.role === "approver"
              ? "Add the Drive settings in Vercel (GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_FOLDER_ID), then redeploy."
              : "Ask an approver to finish connecting the shared Drive folder."}
          </p>
        </div>
      </>
    );
  }

  let docs: DriveDoc[] = [];
  let failure: string | null = null;
  try {
    docs = await listFolderDocs();
  } catch (e) {
    failure = driveErrorMessage(e);
  }

  const imported = new Map<string, Imported>();
  if (docs.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("articles")
      .select("id, drive_file_id, status, drive_modified_at")
      .in("drive_file_id", docs.map((d) => d.id));
    for (const row of (data ?? []) as Imported[]) imported.set(row.drive_file_id, row);
  }
  const now = requestNow();
  const waiting = docs.filter((d) => !imported.has(d.id)).length;

  return (
    <>
      {header}

      {failure ? (
        <div className="space-y-3">
          <FormMessage message={failure} />
          <RefreshButton className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40">Try again</RefreshButton>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">The folder is empty</p>
          <p className="mt-1 text-sm text-muted">Put a finished Google Doc in the shared Knowledge Hub folder, then refresh this page.</p>
          <div className="mt-4">
            <RefreshButton className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">Refresh</RefreshButton>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {docs.length} {docs.length === 1 ? "Doc" : "Docs"} in the folder · {waiting} not imported yet
            </p>
            <RefreshButton className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-border/40">Refresh list</RefreshButton>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {docs.map((d) => {
              const a = imported.get(d.id);
              const changedSince = a?.drive_modified_at && new Date(d.modifiedTime) > new Date(a.drive_modified_at);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{d.name || "Untitled Doc"}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      Edited {timeAgo(d.modifiedTime, now)}
                      {d.lastEditor ? ` by ${d.lastEditor}` : ""}
                    </p>
                    {changedSince ? (
                      <p className="mt-1 text-xs font-medium text-warning">
                        The Doc changed after it was imported{a.status === "draft" ? ". Open the draft and use Refresh from Doc." : "."}
                      </p>
                    ) : null}
                  </div>
                  {a ? (
                    <div className="flex items-center gap-3">
                      <StatusBadge status={a.status} />
                      <Link href={`/articles/${a.id}`} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">
                        Open
                      </Link>
                    </div>
                  ) : (
                    <ImportButton fileId={d.id} name={d.name} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
