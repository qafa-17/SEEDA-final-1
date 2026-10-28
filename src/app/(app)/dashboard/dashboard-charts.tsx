"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityPoint, RangeKey } from "@/lib/content/overview-math";

const RANGES: { key: RangeKey; label: string; long: string }[] = [
  { key: "3m", label: "3M", long: "the last 3 months" },
  { key: "6m", label: "6M", long: "the last 6 months" },
  { key: "1y", label: "1Y", long: "the last 12 months" },
  { key: "all", label: "All", long: "all time" },
];

function ActivityTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> {get("published")} published</p>
      <p className="flex items-center gap-2"><span className="h-0.5 w-2 bg-accent" /> {get("imported")} imported</p>
    </div>
  );
}

/**
 * "Publishing activity": articles published (filled area) and imported
 * (thin line) over time, with range tabs. All ranges arrive from the
 * server at once, so switching is instant.
 */
export function ActivityPanel({ activity }: { activity: Record<RangeKey, ActivityPoint[]> }) {
  const [range, setRange] = useState<RangeKey>("6m");
  const gradient = useId().replace(/:/g, "");
  const data = activity[range];
  const published = data.reduce((n, p) => n + p.published, 0);
  const imported = data.reduce((n, p) => n + p.imported, 0);
  const long = RANGES.find((r) => r.key === range)!.long;

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-2 shadow-card xl:col-span-3" aria-labelledby="activity-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2">
        <h2 id="activity-title" className="text-lg font-semibold">Publishing activity</h2>
        <div role="tablist" aria-label="Time range" className="flex gap-1 rounded-lg bg-background p-1 shadow-card">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`h-7 rounded-md px-3 text-sm font-medium transition-colors ${range === r.key ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3">
        <span className="font-display text-3xl font-semibold">{published}</span>
        <span className="text-sm text-muted">published in {long}</span>
        <span className="text-sm text-muted">· <span className="font-medium text-foreground">{imported}</span> imported</span>
      </div>
      <div className="relative mt-1 min-h-72 flex-1 rounded-xl bg-background/60 p-2 pt-5 shadow-card">
        <p className="sr-only">{`${published} articles published and ${imported} imported in ${long}.`}</p>
        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
          <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical horizontal={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip content={<ActivityTooltip />} cursor={{ stroke: "var(--muted)", strokeOpacity: 0.4 }} />
            <Area type="monotone" dataKey="published" stroke="var(--primary)" strokeWidth={3} fill={`url(#${gradient})`} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="imported" stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="4 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 px-3 pb-1 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Published</span>
        <span className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed border-accent" /> Imported</span>
      </div>
    </section>
  );
}

/** A tiny trend line for a stat tile. Decorative: the tile states the number in words. */
export function Sparkline({ values }: { values: { label: string; value: number }[] }) {
  const gradient = useId().replace(/:/g, "");
  return (
    <div className="hidden h-10 w-24 sm:block" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={values} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--status-published)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--status-published)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke="var(--status-published)" strokeWidth={2} fill={`url(#${gradient})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
