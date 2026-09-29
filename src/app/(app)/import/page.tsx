import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StageNotice } from "@/components/stage-notice";

export const metadata: Metadata = { title: "Import from Drive" };

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import from Drive" description="Choose a finished Google Doc from the shared Knowledge Hub folder." />
      <StageNotice stage={6}>
        The hub will list every Doc in the shared Drive folder here. It reads your Docs and never edits them.
      </StageNotice>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
        <p className="font-medium">No Drive folder connected yet</p>
        <p className="mt-1 text-sm text-muted">Once connected, your Docs show up here with their last-edited date.</p>
      </div>
    </>
  );
}
