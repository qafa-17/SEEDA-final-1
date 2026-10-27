"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { FaCanadianMapleLeaf, FaFlagUsa } from "react-icons/fa";
import { MAP_LAND, MAP_PLACES, MAP_SIZE } from "@/lib/ideas/map-data";

export type MapArea = {
  slug: string;
  label: string;
  country: "canada" | "united states";
  count: number;
  /** Newest first, at most a handful. */
  research: { id: string; keyword: string; when: string; resultsOnly: boolean }[];
};

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

// Short names on the map, and which side of the marker each sits on, so
// neighbouring labels (BC, Alberta, Saskatchewan, Manitoba) never overlap.
const LABELS: Record<string, { text: string; side: "above" | "below" }> = {
  "british-columbia": { text: "BC", side: "above" },
  alberta: { text: "Alberta", side: "below" },
  saskatchewan: { text: "Sask.", side: "above" },
  manitoba: { text: "Manitoba", side: "below" },
  "western-canada": { text: "All Western Canada", side: "above" },
  "pacific-northwest": { text: "Pacific NW", side: "below" },
  "permian-basin": { text: "Permian Basin", side: "above" },
  "us-gulf-coast": { text: "Gulf Coast", side: "below" },
};

/**
 * The research areas on a map of western North America. Each marker shows
 * how much keyword research the team has done there; choosing one lists
 * that research beside the map. The map is a plain drawing built ahead of
 * time (scripts/map/build.ts): no map service, no tracking, works offline.
 */
export function IdeasMap({ areas, initial }: { areas: MapArea[]; initial?: string }) {
  const [selected, setSelected] = useState<string>(initial ?? areas.find((a) => a.count > 0)?.slug ?? areas[0].slug);
  const area = areas.find((a) => a.slug === selected) ?? areas[0];
  const most = Math.max(1, ...areas.map((a) => a.count));

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface">
      {/* The map. Markers are placed in percentages, so they stay on their spot at any size. */}
      <div className="relative w-full" style={{ aspectRatio: `${MAP_SIZE.width} / ${MAP_SIZE.height}`, background: "color-mix(in srgb, var(--primary) 7%, var(--background))" }}>
        <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} className="absolute inset-0 h-full w-full" aria-hidden>
          {MAP_LAND.map((s) => (
            <path
              key={s.country}
              d={s.d}
              fill="var(--surface)"
              fillOpacity={s.country === "other" ? 0.5 : 1}
              stroke="var(--muted)"
              strokeOpacity={0.35}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          ))}
        </svg>

        <ul className="absolute inset-0" aria-label="Research areas">
          {MAP_PLACES.map((p) => {
            const a = areas.find((x) => x.slug === p.slug);
            if (!a) return null;
            const isSelected = a.slug === selected;
            // Bigger marker for more research; an empty ring where there is none yet.
            const size = a.count === 0 ? 14 : 14 + Math.round((a.count / most) * 12);
            return (
              <li key={p.slug} className="absolute" style={{ left: pct(p.x, MAP_SIZE.width), top: pct(p.y, MAP_SIZE.height) }}>
                <button
                  type="button"
                  onClick={() => setSelected(a.slug)}
                  aria-pressed={isSelected}
                  aria-label={`${a.label}: ${a.count === 0 ? "no research yet" : `${a.count} research ${a.count === 1 ? "run" : "runs"}`}`}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1"
                >
                  {isSelected ? (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-primary/25"
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1.9, opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={`relative block rounded-full border-2 border-surface shadow-md transition-transform group-hover:scale-125 ${isSelected ? "scale-125 ring-4 ring-primary/30" : ""} ${a.count === 0 ? "bg-surface outline outline-2 outline-primary/60" : "bg-primary"}`}
                    style={{ width: size, height: size }}
                  />
                </button>
                {/* Name labels show from tablet width up; on phones the card names the area. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-0 hidden -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm md:block ${LABELS[a.slug]?.side === "above" ? "bottom-3" : "top-3"} ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`}
                >
                  {LABELS[a.slug]?.text ?? a.label}
                  <span className="ml-1 opacity-75">{a.count}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-[11px] text-muted shadow-sm">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> researched</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-primary/60" /> not yet</span>
          <span className="hidden sm:inline">Bigger means more research</span>
        </div>
      </div>

      {/* Details for the chosen area. */}
      {/* Over the map's empty east side on wide screens; under the map on smaller ones. */}
      <div className="border-t border-border p-5 lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:w-80 lg:overflow-y-auto lg:rounded-xl lg:border lg:bg-surface/95 lg:shadow-xl lg:backdrop-blur" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={area.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {area.country === "canada" ? <FaCanadianMapleLeaf aria-hidden /> : <FaFlagUsa aria-hidden />}
              {area.country === "canada" ? "Canada" : "United States"}
            </p>
            <h3 className="mt-1 font-display text-xl font-bold">{area.label}</h3>
            <p className="mt-1 text-sm text-muted">
              {area.count === 0 ? "No keyword research here yet." : `${area.count} keyword research ${area.count === 1 ? "run" : "runs"} by the team.`}
            </p>

            {area.research.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                {area.research.map((r) => (
                  <li key={r.id}>
                    <Link href={`/ideas?search=${r.id}&view=map`} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-background">
                      <span className="min-w-0 truncate font-medium">{r.keyword}</span>
                      <span className="shrink-0 text-xs text-muted">{r.resultsOnly ? "results only · " : ""}{r.when}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <Link
              href={`/ideas?${new URLSearchParams({ view: "map", region: area.slug })}`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Research a keyword here
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
