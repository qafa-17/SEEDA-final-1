// Display names and colours for workflow values. Database values never
// appear raw on screen.

export const STATUSES = ["draft", "in_review", "approved", "published"] as const;
export type ArticleStatus = (typeof STATUSES)[number];

export const statusMeta: Record<ArticleStatus, { label: string; hint: string; dot: string; badge: string; bar: string }> = {
  draft: {
    label: "Draft",
    hint: "Details still being filled in",
    dot: "bg-status-draft",
    badge: "bg-status-draft/10 text-status-draft",
    bar: "border-t-status-draft",
  },
  in_review: {
    label: "In Review",
    hint: "Waiting on an approver",
    dot: "bg-status-review",
    badge: "bg-status-review/10 text-status-review",
    bar: "border-t-status-review",
  },
  approved: {
    label: "Approved",
    hint: "Ready to publish",
    dot: "bg-status-approved",
    badge: "bg-status-approved/10 text-status-approved",
    bar: "border-t-status-approved",
  },
  published: {
    label: "Published",
    hint: "Live and verified",
    dot: "bg-status-published",
    badge: "bg-status-published/10 text-status-published",
    bar: "border-t-status-published",
  },
};

export const eventLabels: Record<string, string> = {
  created: "Imported",
  submitted: "Submitted for review",
  approved: "Approved",
  changes_requested: "Changes requested",
  withdrawn: "Withdrawn by owner",
  reopened: "Reopened for edits",
  published: "Published",
};

export const publishStateLabels: Record<string, string> = {
  queued: "Queued",
  pr_open: "Pull request open",
  merged: "Merged, waiting for the site",
  verified: "Live and in the sitemap",
  failed: "Failed",
};

export const FORMER_MEMBER = "Former member";

const TZ = "America/Edmonton"; // EPCMst is in Calgary

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: TZ }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(iso));

/** "3 days ago", "in 2 hours". `now` is passed in so a page uses one consistent clock. */
export function timeAgo(iso: string, now: number): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}

/** The server's clock for this request. Kept out of components so rendering stays pure. */
export const requestNow = () => Date.now();
