import { statusMeta, type ArticleStatus } from "@/lib/content/status";

export function StatusBadge({ status }: { status: ArticleStatus }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${m.badge}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function CountChip({ tone, children }: { tone: "danger" | "warning" | "success"; children: React.ReactNode }) {
  const tones = {
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
