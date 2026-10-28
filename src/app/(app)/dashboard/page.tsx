import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth";
import { requestNow } from "@/lib/content/status";
import { loadBoard, parseBoardParams } from "@/lib/content/board-query";
import { loadOverview } from "@/lib/content/overview";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireActiveUser();
  const sp = await searchParams;
  const params = parseBoardParams(sp);
  const now = requestNow();
  const [board, overview] = await Promise.all([loadBoard(params, user.id), loadOverview(now)]);
  return <DashboardView userId={user.id} fullName={user.fullName} sp={sp} params={params} board={board} overview={overview} now={now} />;
}
