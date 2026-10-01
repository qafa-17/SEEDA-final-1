import type { AppRole } from "@/lib/auth";

const labels: Record<AppRole, { text: string; className: string }> = {
  publisher: { text: "Publisher", className: "bg-status-approved/10 text-status-approved" },
  approver: { text: "Approver", className: "bg-accent/10 text-accent" },
};

export function RoleBadge({ role }: { role: AppRole }) {
  const { text, className } = labels[role];
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{text}</span>;
}
