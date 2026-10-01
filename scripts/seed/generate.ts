/**
 * Synthetic data generator for Content Operations.
 *
 *   npx tsx scripts/seed/generate.ts            # 150 articles (default)
 *   ARTICLES=300 npx tsx scripts/seed/generate.ts
 *
 * Writes supabase/seed/seed.sql (paste into the Supabase SQL Editor).
 * Everything is fictional and marked so it can be removed cleanly:
 * people use @example.com addresses, articles' Drive ids start with "seed_".
 * A fixed random seed means the same input always gives the same output.
 */
import { writeFileSync } from "node:fs";
import { LIMITS, blockingProblems, guidelineChecks, slugify, type ArticleFields } from "../../src/lib/content/rules";

const ARTICLE_COUNT = Number(process.env.ARTICLES ?? 150);
const NOW = Date.parse("2026-10-01T15:00:00Z"); // fixed "today" so output is repeatable

// ---------- deterministic randomness ----------
let state = 20261001;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p: number) => rand() < p;
const uuid = () => {
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = "4";
  h[16] = "89ab"[Math.floor(rand() * 4)];
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};
const driveId = () => "seed_" + Array.from({ length: 28 }, () => pick("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789".split(""))).join("");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ---------- the fictional team ----------
type Person = { id: string; name: string; email: string; role: "publisher" | "approver"; access: "active" | "pending" };
const team: Person[] = [
  { name: "Dana Whitford", role: "approver", access: "active" },
  { name: "Ravi Menon", role: "approver", access: "active" },
  { name: "Leah Tran", role: "publisher", access: "active" },
  { name: "Marcus Okafor", role: "publisher", access: "active" },
  { name: "Sofia Alvarez", role: "publisher", access: "active" },
  { name: "Jordan Pike", role: "publisher", access: "active" },
  { name: "Amira Haddad", role: "publisher", access: "active" },
  { name: "Taylor Brooks", role: "publisher", access: "pending" },
].map((p) => ({ ...p, id: uuid(), email: `${p.name.toLowerCase().replace(/\s+/g, ".")}@example.com` })) as Person[];
const approvers = team.filter((p) => p.role === "approver");
const publishers = team.filter((p) => p.access === "active");

// ---------- subject matter ----------
type Topic = { area: "engineering" | "procurement" | "construction" | "management"; keyword: string; noun: string };
const topics: Topic[] = [
  { area: "engineering", keyword: "front-end engineering design", noun: "FEED" },
  { area: "engineering", keyword: "brownfield tie-ins", noun: "brownfield tie-in work" },
  { area: "engineering", keyword: "3D laser scanning", noun: "3D laser scanning" },
  { area: "engineering", keyword: "HAZOP reviews", noun: "HAZOP review" },
  { area: "engineering", keyword: "constructability reviews", noun: "constructability review" },
  { area: "engineering", keyword: "electrical load studies", noun: "electrical load study" },
  { area: "procurement", keyword: "long-lead equipment", noun: "long-lead equipment" },
  { area: "procurement", keyword: "vendor qualification", noun: "vendor qualification" },
  { area: "procurement", keyword: "expediting", noun: "expediting" },
  { area: "procurement", keyword: "modular fabrication contracts", noun: "modular fabrication contracting" },
  { area: "procurement", keyword: "supply chain risk", noun: "supply chain risk management" },
  { area: "procurement", keyword: "bid evaluation", noun: "bid evaluation" },
  { area: "construction", keyword: "modular construction", noun: "modular construction" },
  { area: "construction", keyword: "winter construction", noun: "winter construction" },
  { area: "construction", keyword: "turnaround planning", noun: "turnaround planning" },
  { area: "construction", keyword: "site logistics", noun: "site logistics" },
  { area: "construction", keyword: "commissioning", noun: "commissioning" },
  { area: "construction", keyword: "workforce camps", noun: "workforce camp planning" },
  { area: "management", keyword: "stage-gate project controls", noun: "stage-gate project control" },
  { area: "management", keyword: "cost estimating", noun: "cost estimating" },
  { area: "management", keyword: "schedule risk analysis", noun: "schedule risk analysis" },
  { area: "management", keyword: "owner's representative services", noun: "owner's representation" },
  { area: "management", keyword: "change management", noun: "change management" },
  { area: "management", keyword: "contractor performance", noun: "contractor performance management" },
];
const sectors = ["Oil and Gas", "Mining", "Power and Utilities", "Water and Wastewater", "Petrochemicals", "Renewables"];
// t = how the region reads in a title ("Oil Sands Projects"); p = in a sentence ("in the Oil Sands region").
const regions = [
  { t: "Alberta", p: "Alberta" }, { t: "Northern Alberta", p: "northern Alberta" }, { t: "British Columbia", p: "British Columbia" },
  { t: "Saskatchewan", p: "Saskatchewan" }, { t: "Western Canada", p: "Western Canada" }, { t: "Oil Sands", p: "the Oil Sands region" },
];
const an = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const facilities = ["gas processing plant", "tailings facility", "substation", "water treatment plant", "upgrader", "solar farm", "mill expansion", "pipeline terminal"];
const types = ["whitepaper", "case-study", "technical-insight"] as const;
const typeWeights = [0.2, 0.3, 0.5];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SMALL = new Set(["a", "an", "and", "at", "for", "from", "in", "of", "on", "or", "the", "to"]);
/** Headline case: major words capitalised, small words lower, acronyms (FEED, HAZOP, 3D) kept. */
const titleCase = (s: string) =>
  s.split(" ").map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase()
    : w.split("-").map((part) => (part === part.toUpperCase() ? part : part.charAt(0).toUpperCase() + part.slice(1))).join("-"))).join(" ");

function titleFor(t: Topic, type: (typeof types)[number], sector: string, region: string, facility: string): string {
  const options =
    type === "case-study"
      ? [`Case Study: ${cap(t.noun)} on ${an(region)} ${region} ${cap(facility)}`, `How ${cap(t.keyword)} Kept ${an(sector)} ${sector} Project on Track`, `Case Study: ${cap(t.keyword)} at ${an(facility)} ${cap(facility)}`]
      : type === "whitepaper"
        ? [`A Practical Guide to ${cap(t.keyword)} in ${sector}`, `${cap(t.keyword)}: What ${sector} Owners Should Know`, `${cap(t.keyword)} for ${region} Projects`]
        : [`${between(3, 7)} Lessons on ${cap(t.keyword)} from ${region} Projects`, `The Case for ${cap(t.keyword)} on ${sector} Projects`, `${cap(t.keyword)} on ${sector} Sites: Common Pitfalls`];
  return titleCase(pick(options));
}

const sentenceBank = [
  "On {sector} projects in {region}, {noun} is often decided early and paid for late.",
  "Owners who treat {noun} as a box to tick usually discover the cost during construction.",
  "Our teams have seen the same pattern across several {sector} sites: small gaps early become schedule slips later.",
  "The first step is agreeing what a good outcome looks like before the design is frozen.",
  "That means naming one accountable person and a clear decision date.",
  "Weather, remote access and short construction seasons in {region} all raise the stakes.",
  "A simple checklist, reviewed at each stage gate, catches most of the issues we see.",
  "Field crews should be involved before drawings are issued for construction, not after.",
  "Vendors respond better when expectations are written down and measured the same way every time.",
  "Data from the last turnaround is the best predictor of the next one, if anyone kept it.",
  "Cost and schedule risk rarely come from one big decision; they build up from many small ones.",
  "Good {noun} is mostly about communication between engineering, procurement and the field.",
  "Regulators and Indigenous partners expect early, honest engagement, and projects go smoother when they get it.",
  "Digital tools help, but only if the people using them trust the information inside.",
  "The cheapest change is the one made on paper; the most expensive is the one made in steel.",
  "We recommend a short review at thirty, sixty and ninety percent design for every {facility}.",
  "Lessons learned only count if the next project actually reads them.",
  "Clear interfaces between contractors prevent the gaps where most rework begins.",
  "When equipment arrives late, every downstream trade waits, and the camp costs keep running.",
  "Measuring progress weekly, with the same yardstick, keeps surprises small.",
];
const headingBank = [
  "Why it matters", "Where projects go wrong", "What good looks like", "A practical approach", "Lessons from the field",
  "Planning for {region} conditions", "Working with contractors", "Measuring results", "Getting started", "Key risks to watch",
];
const linkBank = [
  "[our {area} services](/services/{area})",
  "[other Knowledge Hub articles](/knowledge-hub)",
  "[the EPCMst project approach](/about)",
];

function fill(s: string, ctx: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "");
}

function paragraph(ctx: Record<string, string>, n: number) {
  const used = new Set<number>();
  const out: string[] = [];
  while (out.length < n) {
    const i = Math.floor(rand() * sentenceBank.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(fill(sentenceBank[i], ctx));
  }
  return out.join(" ");
}

function body(ctx: Record<string, string>, opts: { words: number; keywordInIntro: boolean; subheadings: boolean; link: boolean }) {
  const intro = (opts.keywordInIntro ? `${cap(ctx.keyword)} is one of the decisions that shapes every ${ctx.sector} project in ${ctx.region}. ` : "")
    + paragraph(ctx, 4);
  const parts = [intro];
  let words = intro.split(/\s+/).length;
  const headings = [...headingBank].sort(() => rand() - 0.5);
  let h = 0;
  while (words < opts.words) {
    if (opts.subheadings && h < headings.length && (parts.length === 1 || chance(0.5))) parts.push(`## ${fill(headings[h++], ctx)}`);
    const p = paragraph(ctx, between(4, 6));
    parts.push(p);
    words += p.split(/\s+/).length;
  }
  if (opts.link) parts.push(`For related work, see ${fill(pick(linkBank), ctx)}.`);
  return parts.join("\n\n");
}

function metaFor(t: Topic, sector: string, region: string, includeKeyword: boolean): string {
  const options = includeKeyword
    ? [
        `How ${t.keyword} can cut cost and schedule risk on ${sector} projects in ${region}, with practical steps from EPCM teams.`,
        `A practical look at ${t.keyword} for ${sector} owners in ${region}: where projects go wrong and what good looks like.`,
      ]
    : [`Practical lessons from ${sector} projects in ${region} on reducing cost and schedule risk before construction starts.`];
  return pick(options);
}

// ---------- articles ----------
type Status = "draft" | "in_review" | "approved" | "published";
type Event = { kind: string; from: Status | null; to: Status; actor: string; note: string | null; at: number };
type Seeded = ArticleFields & {
  id: string; drive_file_id: string; drive_modified_at: string; type: string; area: string; status: Status; owner_id: string;
  submitted_at: number | null; approved_by: string | null; approved_at: number | null; published_at: number | null;
  published_url: string | null; created_at: number; updated_at: number; events: Event[];
  jobs: { state: string; requested_by: string; at: number; http: number | null; sitemap: boolean | null; error: string | null; pr: number }[];
};

const statusMix: [Status, number][] = [["draft", 0.36], ["in_review", 0.16], ["approved", 0.1], ["published", 0.38]];
function pickStatus(): Status {
  let r = rand();
  for (const [s, w] of statusMix) { if ((r -= w) < 0) return s; }
  return "published";
}
function pickType() {
  let r = rand();
  for (let i = 0; i < types.length; i++) { if ((r -= typeWeights[i]) < 0) return types[i]; }
  return types[2];
}

const usedSlugs = new Set<string>();
const articles: Seeded[] = [];
let prNumber = 100;

for (let i = 0; i < ARTICLE_COUNT; i++) {
  const t = pick(topics), sector = pick(sectors), reg = pick(regions), region = reg.p, facility = pick(facilities), type = pickType();
  const status = pickStatus();
  const owner = pick(publishers);
  const ctx = { sector, region, facility, noun: t.noun, keyword: t.keyword, area: t.area };
  const complete = status !== "draft" || chance(0.35); // most drafts are still being filled in
  // Leave enough time before "today" for this status's whole history.
  const minAgeDays = { draft: 1, in_review: 14, approved: 26, published: 36 }[status];
  const created = NOW - between(minAgeDays, minAgeDays + 170) * DAY - between(0, 86_000) * 1000;

  // Valid articles get a title and description that fit the rules; drafts
  // may break them on purpose further down.
  let title: string | null = titleFor(t, type, sector, reg.t, facility);
  for (let tries = 0; title.length > LIMITS.titleMax && tries < 20; tries++) title = titleFor(t, type, sector, pick(["Alberta", "BC"]), facility);
  if (title.length > LIMITS.titleMax) title = `${cap(t.keyword)} in ${sector}`.slice(0, LIMITS.titleMax);
  let slug: string | null = slugify(title);
  for (let n = 2; slug && usedSlugs.has(slug); n++) slug = `${slugify(title).slice(0, 75)}-${n}`;
  const withKw = chance(0.85);
  let meta: string | null = metaFor(t, sector, region, withKw);
  for (let tries = 0; (meta.length > LIMITS.metaMax || meta.length < LIMITS.metaMin) && tries < 20; tries++) meta = metaFor(t, sector, pick(["Alberta", "BC"]), withKw);
  if (meta.length > LIMITS.metaMax) meta = `Practical lessons on ${t.keyword} for ${sector} owners, from EPCM teams working across Western Canada.`.slice(0, LIMITS.metaMax);
  let keyword: string | null = t.keyword;
  let author: string | null = chance(0.6) ? owner.name : "EPCMst Team";
  let publishDate: string | null = isoDate(created + between(14, 60) * DAY);
  let typeSlug: string | null = type, areaSlug: string | null = t.area;
  let words = between(350, 850);
  let text = body(ctx, { words, keywordInIntro: chance(0.75), subheadings: chance(0.85), link: chance(0.6) });

  if (!complete) {
    // Realistic gaps and mistakes in work-in-progress drafts.
    const gaps = between(1, 4);
    for (let g = 0; g < gaps; g++) {
      const which = between(0, 8);
      if (which === 0) meta = null;
      if (which === 1) meta = `${cap(t.keyword)} on ${sector} projects.`; // too short
      if (which === 2) meta = metaFor(t, sector, region, true) + " Includes a checklist for owners, contractors and site teams working through the next season."; // too long
      if (which === 3) slug = null;
      if (which === 4) keyword = null;
      if (which === 5 && title && !title.includes("Field Guide")) title = `${title}: A Field Guide for Owners and Site Teams`; // likely too long
      if (which === 6) publishDate = null;
      if (which === 7) { typeSlug = null; areaSlug = null; }
      if (which === 8) author = null;
    }
    if (chance(0.08)) { text = ""; words = 0; } // imported, body not converted yet
  }
  if (slug) usedSlugs.add(slug);

  const a: Seeded = {
    id: uuid(), drive_file_id: driveId(), drive_modified_at: iso(created - between(1, 10) * DAY),
    title, slug, meta_description: meta, content_type_id: typeSlug ? types.indexOf(typeSlug as (typeof types)[number]) + 1 : null,
    service_area_id: areaSlug ? 1 : null, target_keyword: keyword, author_name: author, publish_date: publishDate, body_markdown: text,
    type: typeSlug ?? "", area: areaSlug ?? "", status, owner_id: owner.id,
    submitted_at: null, approved_by: null, approved_at: null, published_at: null, published_url: null,
    created_at: created, updated_at: created, events: [], jobs: [],
  };

  // Non-drafts must pass the blocking rules, exactly as the database demands.
  if (status !== "draft" && blockingProblems(a).length > 0) {
    throw new Error(`Generator bug: ${status} article fails blocking rules: ${blockingProblems(a).join(" ")}`);
  }

  // History, consistent with the status and in time order.
  let at = created;
  a.events.push({ kind: "created", from: null, to: "draft", actor: owner.id, note: null, at });
  if (status !== "draft") {
    at += between(1, 12) * DAY;
    a.events.push({ kind: "submitted", from: "draft", to: "in_review", actor: owner.id, note: null, at });
    if (status !== "in_review" && chance(0.3)) {
      at += between(1, 4) * DAY;
      a.events.push({ kind: "changes_requested", from: "in_review", to: "draft", actor: pick(approvers).id,
        note: pick(["Please add a section on winter conditions.", "Tighten the meta description and add a link to the services page.", "Check the figures in the second section with the project lead.", "Add a subheading before the lessons section."]), at });
      at += between(1, 5) * DAY;
      a.events.push({ kind: "submitted", from: "draft", to: "in_review", actor: owner.id, note: null, at });
    }
    a.submitted_at = at;
    if (status === "approved" || status === "published") {
      const approver = pick(approvers);
      at += between(1, 6) * DAY;
      a.events.push({ kind: "approved", from: "in_review", to: "approved", actor: approver.id, note: null, at });
      a.approved_by = approver.id;
      a.approved_at = at;
    }
    if (status === "published") {
      const approver = pick(approvers);
      if (chance(0.12)) {
        at += between(1, 2) * DAY;
        a.jobs.push({ state: "failed", requested_by: approver.id, at, http: 404, sitemap: false, error: "The page was not live 10 minutes after the merge. The site build may have been delayed.", pr: prNumber++ });
      }
      at += between(1, 3) * DAY;
      a.jobs.push({ state: "verified", requested_by: approver.id, at, http: 200, sitemap: true, error: null, pr: prNumber++ });
      a.events.push({ kind: "published", from: "approved", to: "published", actor: approver.id, note: null, at });
      a.published_at = at;
      a.published_url = `https://demo.example.com/knowledge-hub/${a.slug}`;
    }
  }
  if (at > NOW) throw new Error("Generator bug: event in the future");
  a.updated_at = at;
  articles.push(a);
}

// ---------- SQL output: split into parts small enough to paste ----------
const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const qt = (ms: number | null) => (ms === null ? "null" : `'${iso(ms)}'`);
const lookup = (table: string, slug: string) => (slug ? `(select id from public.${table} where slug = ${q(slug)})` : "null");

const PER_PART = 50;
const parts = Math.ceil(articles.length / PER_PART);
let totalKB = 0;

for (let part = 0; part < parts; part++) {
  const chunk = articles.slice(part * PER_PART, (part + 1) * PER_PART);
  const out: string[] = [];
  out.push(`-- =====================================================================
-- Synthetic data, part ${part + 1} of ${parts} (generated by scripts/seed/generate.ts)
-- ${chunk.length} articles${part === 0 ? ` and ${team.length} fictional people` : ""}. Everything here is invented.
-- Run the parts IN ORDER in Supabase > SQL Editor. Remove everything with remove_seed.sql.
-- =====================================================================
begin;

do $$ begin
  if exists (select 1 from public.articles where id = '${chunk[0].id}') then
    raise exception 'Part ${part + 1} is already loaded.';
  end if;${part > 0 ? `
  if not exists (select 1 from public.profiles where id = '${team[0].id}') then
    raise exception 'Run part 1 first.';
  end if;` : ""}
end $$;
`);
  if (part === 0) {
    out.push(`-- Fictional team. Empty passwords: these accounts cannot sign in.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
${team.map((p) => `  ('${p.id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(p.email)}, '', now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ full_name: p.name }))}, now() - interval '210 days', now(), '', '', '', '')`).join(",\n")};

-- Their profiles were created by the sign-up trigger; set roles and access.
${team.map((p) => `update public.profiles set role = '${p.role}', access = '${p.access}' where id = '${p.id}';`).join("\n")}
`);
  }
  out.push(`-- Back-dated rows: pause the two article triggers so history and timestamps stay as generated.
alter table public.articles disable trigger articles_log_created;
alter table public.articles disable trigger articles_set_updated_at;
`);
  for (const a of chunk) {
    out.push(`insert into public.articles (id, drive_file_id, drive_modified_at, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown, status, owner_id, submitted_at, approved_by, approved_at, published_at, published_url, created_at, updated_at) values ('${a.id}', '${a.drive_file_id}', '${a.drive_modified_at}', ${q(a.title)}, ${q(a.slug)}, ${q(a.meta_description)}, ${lookup("content_types", a.type)}, ${lookup("service_areas", a.area)}, ${q(a.target_keyword)}, ${q(a.author_name)}, ${q(a.publish_date)}, ${q(a.body_markdown)}, '${a.status}', '${a.owner_id}', ${qt(a.submitted_at)}, ${a.approved_by ? `'${a.approved_by}'` : "null"}, ${qt(a.approved_at)}, ${qt(a.published_at)}, ${q(a.published_url)}, ${qt(a.created_at)}, ${qt(a.updated_at)});`);
  }
  const jobs = chunk.flatMap((a) => a.jobs.map((j) => `  ('${a.id}', '${j.requested_by}', '${j.state}', 'publish/${a.slug}', ${j.pr}, 'https://github.com/example/knowledge-hub-demo/pull/${j.pr}', ${q(a.published_url ?? `https://demo.example.com/knowledge-hub/${a.slug}`)}, ${j.http ?? "null"}, ${j.sitemap ?? "null"}, ${q(j.error)}, ${qt(j.at)}, ${qt(j.at)})`));
  out.push(`
alter table public.articles enable trigger articles_log_created;
alter table public.articles enable trigger articles_set_updated_at;

-- History
insert into public.article_events (article_id, kind, from_status, to_status, actor_id, note, created_at) values
${chunk.flatMap((a) => a.events.map((e) => `  ('${a.id}', '${e.kind}', ${e.from ? `'${e.from}'` : "null"}, '${e.to}', '${e.actor}', ${q(e.note)}, ${qt(e.at)})`)).join(",\n")};
${jobs.length ? `
-- Publish attempts
insert into public.publish_jobs (article_id, requested_by, state, branch, pr_number, pr_url, live_url, http_status, in_sitemap, error_message, created_at, updated_at) values
${jobs.join(",\n")};
` : ""}
-- Guideline checks (same rules the app uses)
insert into public.article_checks (article_id, rule_key, result, message, checked_at) values
${chunk.flatMap((a) => guidelineChecks(a).map((c) => `  ('${a.id}', '${c.rule_key}', '${c.result}', ${q(c.message)}, ${qt(a.updated_at)})`)).join(",\n")};

commit;
`);
  const sql = out.join("\n");
  totalKB += sql.length / 1024;
  writeFileSync(`supabase/seed/seed_part${part + 1}.sql`, sql);
}

const byStatus = Object.fromEntries(statusMix.map(([s]) => [s, articles.filter((a) => a.status === s).length]));
const draftsWithProblems = articles.filter((a) => a.status === "draft" && blockingProblems(a).length > 0).length;
console.log(JSON.stringify({ articles: articles.length, parts, byStatus, draftsWithProblems,
  events: articles.reduce((n, a) => n + a.events.length, 0), jobs: articles.reduce((n, a) => n + a.jobs.length, 0),
  checks: articles.length * 7, totalKB: Math.round(totalKB) }, null, 2));

// ---------- removal script ----------
writeFileSync("supabase/seed/remove_seed.sql", `-- Removes ONLY the synthetic data from seed.sql: seeded articles (their
-- history, checks and publish attempts go with them) and the fictional team.
-- Real accounts and real articles are not touched.
begin;
delete from public.articles where drive_file_id like 'seed\\_%';
delete from auth.users where id in (
${team.map((p) => `  '${p.id}'`).join(",\n")}
);
commit;
`);
