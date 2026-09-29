import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StageNotice } from "@/components/stage-notice";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account and your role in the publishing workflow." />
      <StageNotice stage={2}>Your name, email and role (publisher or approver) will show here after sign-in is added.</StageNotice>
    </>
  );
}
