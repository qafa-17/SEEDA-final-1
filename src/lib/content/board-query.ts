import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, type ArticleStatus } from "./status";

export const PAGE_SIZE = 25;

// Everything the board accepts from the URL, checked against a whitelist.
// Anything unexpected falls back to a safe default instead of erroring.
const boardParams = z.object({
  status: z.enum(["all", ...STATUSES]).catch("all"),
  q: z.string().max(100).catch(""),
  type: z.string().regex(/^[a-z0-9-]{1,40}$/).optional().catch(undefined),
  area: z.string().regex(/^[a-z0-9-]{1,40}$/).optional().catch(undefined),
  owner: z.union([z.literal("me"), z.uuid()]).optional().catch(undefined),
  sort: z.enum(["updated", "created", "title"]).catch("updated"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type BoardParams = z.infer<typeof boardParams>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseBoardParams(sp: Record<string, string | string[] | undefined>): BoardParams {
  return boardParams.parse({
    status: first(sp.status) ?? "all",
    q: first(sp.q) ?? "",
    type: first(sp.type) || undefined,
    area: first(sp.area) || undefined,
    owner: first(sp.owner) || undefined,
    sort: first(sp.sort) ?? "updated",
    page: first(sp.page) ?? 1,
  });
}

/**
 * Search text is used inside a database filter, so it is reduced to letters,
 * numbers, spaces, hyphens and apostrophes. That removes every character the
 * filter syntax treats specially (commas, brackets, %, _, quotes, backslashes).
 */
export function cleanSearch(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export type BoardRow = {
  id: string;
  title: string | null;
  slug: string | null;
  meta_description: string | null;
  content_type_id: number | null;
  service_area_id: number | null;
  target_keyword: string | null;
  author_name: string | null;
  publish_date: string | null;
  word_count: number;
  status: ArticleStatus;
  updated_at: string;
  owner_id: string | null;
  content_types: { label: string } | null;
  service_areas: { label: string } | null;
  owner: { full_name: string } | null;
  article_checks: { result: "pass" | "warn" | "fail" }[];
};

export type Option = { value: string; label: string };

export async function loadBoard(params: BoardParams, currentUserId: string) {
  const supabase = await createClient();

  const [typesRes, areasRes, peopleRes] = await Promise.all([
    supabase.from("content_types").select("id, slug, label").order("sort_order"),
    supabase.from("service_areas").select("id, slug, label").order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("access", "active").order("full_name"),
  ]);
  const types = typesRes.data ?? [];
  const areas = areasRes.data ?? [];
  const people = peopleRes.data ?? [];

  const typeId = params.type ? types.find((t) => t.slug === params.type)?.id ?? -1 : undefined;
  const areaId = params.area ? areas.find((a) => a.slug === params.area)?.id ?? -1 : undefined;
  const ownerId = params.owner === "me" ? currentUserId : params.owner;
  const search = cleanSearch(params.q);

  // The same filters feed the list and the per-status counts, so the numbers
  // on the status tiles always match what the list would show.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withFilters = <T extends { eq: any; or: any }>(query: T): T => {
    let q = query;
    if (typeId !== undefined) q = q.eq("content_type_id", typeId);
    if (areaId !== undefined) q = q.eq("service_area_id", areaId);
    if (ownerId) q = q.eq("owner_id", ownerId);
    if (search) q = q.or(`title.ilike.%${search}%,target_keyword.ilike.%${search}%,slug.ilike.%${search}%`);
    return q;
  };

  const countFor = (status?: ArticleStatus) => {
    let q = withFilters(supabase.from("articles").select("id", { count: "exact", head: true }));
    if (status) q = q.eq("status", status);
    return q;
  };

  let list = withFilters(
    supabase
      .from("articles")
      .select(
        "id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, word_count, status, updated_at, owner_id, content_types(label), service_areas(label), owner:profiles!articles_owner_id_fkey(full_name), article_checks(result)",
        { count: "exact" },
      ),
  );
  if (params.status !== "all") list = list.eq("status", params.status);
  list =
    params.sort === "title"
      ? list.order("title", { ascending: true, nullsFirst: false })
      : list.order(params.sort === "created" ? "created_at" : "updated_at", { ascending: false });
  const from = (params.page - 1) * PAGE_SIZE;
  list = list.order("id").range(from, from + PAGE_SIZE - 1);

  const [listRes, allRes, ...statusRes] = await Promise.all([list, countFor(), ...STATUSES.map((s) => countFor(s))]);

  const counts = Object.fromEntries(STATUSES.map((s, i) => [s, statusRes[i].count ?? 0])) as Record<ArticleStatus, number>;

  return {
    rows: (listRes.data ?? []) as unknown as BoardRow[],
    total: listRes.count ?? 0,
    error: Boolean(listRes.error || allRes.error),
    counts: { all: allRes.count ?? 0, ...counts },
    typeOptions: types.map((t) => ({ value: t.slug, label: t.label })) as Option[],
    areaOptions: areas.map((a) => ({ value: a.slug, label: a.label })) as Option[],
    ownerOptions: people.map((p) => ({ value: p.id, label: p.full_name || "Unnamed member" })) as Option[],
  };
}
