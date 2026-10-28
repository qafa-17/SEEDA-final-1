// The Dashboard summary: counts, 30-day windows, chart buckets and areas.
import assert from "node:assert/strict";
import { buildOverview, type OverviewRow } from "../src/lib/content/overview-math";

const DAY = 86_400_000;
const now = Date.parse("2026-10-28T19:00:00Z");
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const areas = [
  { id: 1, slug: "procurement", label: "Procurement" },
  { id: 2, slug: "project-controls", label: "Project Controls" },
  { id: 3, slug: "commissioning", label: "Commissioning" },
];
const row = (r: Partial<OverviewRow>): OverviewRow => ({ status: "draft", created_at: ago(1), submitted_at: null, published_at: null, service_area_id: null, ...r });

const rows: OverviewRow[] = [
  row({ status: "draft", created_at: ago(5), service_area_id: 1 }),
  row({ status: "draft", created_at: ago(45), service_area_id: 1 }),
  row({ status: "in_review", created_at: ago(20), submitted_at: ago(9.5), service_area_id: 2 }),
  row({ status: "in_review", created_at: ago(10), submitted_at: ago(2), service_area_id: 2 }),
  row({ status: "approved", created_at: ago(30), service_area_id: 1 }),
  row({ status: "published", created_at: ago(40), published_at: ago(3), service_area_id: 2 }),
  row({ status: "published", created_at: ago(90), published_at: ago(35), service_area_id: 2 }),
  row({ status: "published", created_at: ago(200), published_at: ago(150), service_area_id: 1 }),
];

const o = buildOverview(rows, areas, now);

assert.deepEqual(o.counts, { draft: 2, in_review: 2, approved: 1, published: 3 });
assert.equal(o.newDrafts30, 1, "only the draft imported 5 days ago");
assert.equal(o.oldestReviewDays, 9, "9.5 days rounds down");
assert.equal(o.published30, 1);
assert.equal(o.publishedPrev30, 1);

// Every range covers all the activity that falls inside it.
const sum = (k: "3m" | "6m" | "1y" | "all", f: "published" | "imported") => o.activity[k].reduce((n, p) => n + p[f], 0);
assert.equal(o.activity["3m"].length, 13);
assert.equal(o.activity["6m"].length, 26);
assert.equal(o.activity["1y"].length, 12);
assert.equal(sum("3m", "published"), 2, "published 3 and 35 days ago");
assert.equal(sum("6m", "published"), 3);
assert.equal(sum("all", "published"), 3);
assert.equal(sum("all", "imported"), rows.length, "every article counted once as imported");
assert.equal(sum("3m", "imported"), 7, "imported within 91 days (all but the one from 200 days ago)");
assert.equal(o.activity.all.at(-1)!.label, "Oct", "last month is this month");
assert.equal(o.publishedMonths.length, 6);
assert.equal(o.publishedMonths.reduce((n, p) => n + p.value, 0), 3, "150 days ago is inside six calendar months");

// Areas: most published first; an area with nothing still listed.
assert.deepEqual(o.areas.map((a) => [a.slug, a.published, a.total]), [
  ["project-controls", 2, 4],
  ["procurement", 1, 4],
  ["commissioning", 0, 0],
]);

// Nothing at all.
const empty = buildOverview([], areas, now);
assert.equal(empty.oldestReviewDays, null);
assert.equal(empty.activity.all.length, 2, "all-time chart still has a line to draw");
assert.ok(empty.activity["6m"].every((p) => p.published === 0 && p.imported === 0));

console.log("overview tests passed");
