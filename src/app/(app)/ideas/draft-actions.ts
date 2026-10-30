"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateJson, isAiConfigured } from "@/lib/ai/gemini";
import { DEFAULT_AUTHOR, guidelineChecks, slugify, type ArticleFields } from "@/lib/content/rules";
import { loadSiteContext } from "@/lib/content/site-context";
import { countryLabel, regionBySlug } from "@/lib/ideas/regions";
import { summarySchema } from "@/lib/ideas/summarize";
import type { SearchResult } from "@/lib/ideas/search";
import { buildHeadlinePrompt, cleanHeadlines, headlineAiSchema, headlineResponseSchema, plannedFor, storedHeadlines, type Headline } from "@/lib/drafts/headlines";
import { blocksToMarkdown, buildDraftPrompt, cleanDraft, draftAiSchema, draftResponseSchema } from "@/lib/drafts/write";
import { DRAFT_LIMITS } from "@/lib/drafts/style";

export type DraftActionState = { message?: string };

const resultsSchema = z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })).max(10);

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadSearch(supabase: Supabase, id: string) {
  const { data } = await supabase.from("idea_searches").select("id, keyword, region, results, summary, ai_status").eq("id", id).maybeSingle();
  if (!data) return null;
  const region = regionBySlug(data.region);
  const results = resultsSchema.safeParse(data.results);
  const summary = data.ai_status === "ok" ? summarySchema.safeParse(data.summary) : null;
  return {
    id: data.id as string,
    keyword: data.keyword as string,
    region: data.region as string,
    areaLabel: region ? `${region.label}, ${countryLabel(region.country)}` : "Western Canada",
    results: (results.success ? results.data : []) as SearchResult[],
    summary: summary?.success ? summary.data : null,
  };
}

async function usage(supabase: Supabase) {
  const { data, error } = await supabase.rpc("draft_request_usage").single();
  if (error || !data) return null;
  const u = data as { headlines_today: number; drafts_today: number; drafts_this_month: number };
  return { headlinesToday: Number(u.headlines_today), draftsToday: Number(u.drafts_today), draftsMonth: Number(u.drafts_this_month) };
}

/** Step 1: suggest headlines for one piece of research, and save them for the team. */
export async function suggestHeadlines(_prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  await requireActiveUser();
  const searchId = z.uuid().safeParse(fd.get("searchId"));
  if (!searchId.success) return { message: "That research couldn't be found." };
  if (!isAiConfigured()) return { message: "The AI service isn't connected yet. An admin needs to add the AI key." };

  const supabase = await createClient();
  const search = await loadSearch(supabase, searchId.data);
  if (!search) return { message: "That research couldn't be found." };

  const used = await usage(supabase);
  if (!used) return { message: "Couldn't check today's allowance. Please try again." };
  if (used.headlinesToday >= DRAFT_LIMITS.headlinesPerPersonPerDay) {
    return { message: `You've asked for headlines ${DRAFT_LIMITS.headlinesPerPersonPerDay} times today. This frees up 24 hours after each request.` };
  }

  const [libraryRes, areasRes, typesRes, titlesRes, pagesRes] = await Promise.all([
    supabase.from("keywords").select("phrase").eq("status", "active").order("phrase"),
    supabase.from("service_areas").select("slug, label").order("sort_order"),
    supabase.from("content_types").select("slug, label").order("sort_order"),
    supabase.from("articles").select("title").not("title", "is", null).order("updated_at", { ascending: false }).limit(200),
    supabase.from("site_pages").select("title").eq("kind", "resource"),
  ]);
  const ctx = {
    keyword: search.keyword,
    areaLabel: search.areaLabel,
    summary: search.summary,
    results: search.results,
    library: (libraryRes.data ?? []).map((k) => k.phrase as string),
    serviceAreas: (areasRes.data ?? []) as { slug: string; label: string }[],
    contentTypes: (typesRes.data ?? []) as { slug: string; label: string }[],
    existingTitles: [...(titlesRes.data ?? []), ...(pagesRes.data ?? [])].map((t) => t.title as string),
  };

  const ai = await generateJson(buildHeadlinePrompt(ctx), headlineResponseSchema, headlineAiSchema, { temperature: 0.7, maxOutputTokens: 6000, timeoutMs: 45_000 });
  let headlines: Headline[] = ai.status === "ok" ? cleanHeadlines(ai.data.headlines, ctx) : [];
  const planned = plannedFor(search.keyword);
  if (planned) headlines = [planned, ...headlines.filter((h) => h.title.toLowerCase() !== planned.title.toLowerCase())].slice(0, 6);

  const ok = headlines.length > 0;
  const { data: saved, error } = await supabase
    .from("draft_requests")
    .insert({ kind: "headlines", search_id: search.id, headlines: ok ? headlines : null, status: ok ? "ok" : "failed" })
    .select("id")
    .single();
  if (!ok) return { message: "The AI service didn't give usable headlines. Please try again in a moment." };
  if (error || !saved) return { message: "The headlines were written but couldn't be saved. Please try again." };

  revalidatePath("/ideas");
  redirect(`/ideas?search=${search.id}&headlines=${saved.id}#headlines`);
}

/** Step 2: write the draft for one chosen headline, and open it in the editor. */
export async function writeDraft(_prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  await requireActiveUser();
  const input = z.object({ requestId: z.uuid(), index: z.coerce.number().int().min(0).max(7) }).safeParse({ requestId: fd.get("requestId"), index: fd.get("index") });
  if (!input.success) return { message: "That headline couldn't be found." };
  if (!isAiConfigured()) return { message: "The AI service isn't connected yet. An admin needs to add the AI key." };

  const supabase = await createClient();
  const { data: request } = await supabase.from("draft_requests").select("id, search_id, headlines").eq("id", input.data.requestId).eq("kind", "headlines").maybeSingle();
  const list = storedHeadlines.safeParse(request?.headlines);
  const headline = list.success ? list.data[input.data.index] : undefined;
  if (!request || !headline) return { message: "That headline couldn't be found." };
  const search = request.search_id ? await loadSearch(supabase, request.search_id) : null;

  const used = await usage(supabase);
  if (!used) return { message: "Couldn't check today's allowance. Please try again." };
  if (used.draftsToday >= DRAFT_LIMITS.draftsPerPersonPerDay) {
    return { message: `You've written ${DRAFT_LIMITS.draftsPerPersonPerDay} drafts today. This frees up 24 hours after each one.` };
  }
  if (used.draftsMonth >= DRAFT_LIMITS.draftsTeamPerMonth) return { message: "The team has used this month's AI drafts. Drafting opens again on the 1st." };

  const [areaRes, typeRes, site] = await Promise.all([
    headline.service_area ? supabase.from("service_areas").select("id, slug, label").eq("slug", headline.service_area).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("content_types").select("id, label").eq("slug", headline.content_type).maybeSingle(),
    loadSiteContext(supabase),
  ]);
  const area = areaRes.data as { id: number; slug: string; label: string } | null;
  const type = typeRes.data as { id: number; label: string } | null;
  const results = search?.results ?? [];

  const ai = await generateJson(
    buildDraftPrompt({
      headline,
      areaLabel: search?.areaLabel ?? "Western Canada",
      service: area ? { label: area.label, path: `/services/${area.slug}` } : null,
      typeLabel: type?.label ?? "Blog Post",
      summary: search?.summary ?? null,
      results,
    }),
    draftResponseSchema,
    draftAiSchema,
    { temperature: 0.6, maxOutputTokens: 16_000, timeoutMs: 100_000 },
  );
  if (ai.status !== "ok") {
    await supabase.from("draft_requests").insert({ kind: "draft", search_id: search?.id ?? null, status: "failed" });
    return { message: "The AI service didn't finish the draft. Please try again in a moment." };
  }

  const draft = cleanDraft({ meta_description: ai.data.meta_description, tags: ai.data.tags, body_markdown: blocksToMarkdown(ai.data.blocks) }, { title: headline.title, sourceUrls: results.map((r) => r.url), sitePaths: site.sitePaths });

  // Suggest a URL from the title if nobody uses it yet.
  let slug: string | null = slugify(headline.title) || null;
  if (slug && site.reservedSlugs.includes(slug)) slug = null;
  if (slug) {
    const { data: taken } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = null;
  }

  const fields: ArticleFields = {
    title: headline.title,
    slug,
    meta_description: draft.meta || null,
    content_type_id: type?.id ?? null,
    service_area_id: area?.id ?? null,
    target_keyword: headline.keyword,
    author_name: DEFAULT_AUTHOR,
    publish_date: null,
    body_markdown: draft.body,
    tags: draft.tags,
    secondary_keywords: headline.extra_keywords,
  };
  const { data: created, error } = await supabase.from("articles").insert({ source: "ai_draft", ...fields }).select("id").single();
  if (error || !created) {
    await supabase.from("draft_requests").insert({ kind: "draft", search_id: search?.id ?? null, status: "failed" });
    return { message: error?.code === "42501" ? "Your account can't create articles." : "The draft was written but couldn't be saved. Please try again." };
  }
  await supabase.from("draft_requests").insert({ kind: "draft", search_id: search?.id ?? null, article_id: created.id, status: "ok" });

  const now = new Date().toISOString();
  await supabase.from("article_checks").upsert(
    guidelineChecks(fields, site).map((c) => ({ article_id: created.id, rule_key: c.rule_key, result: c.result, message: c.message.slice(0, 500), checked_at: now })),
    { onConflict: "article_id,rule_key" },
  );

  revalidatePath("/dashboard");
  const notes = new URLSearchParams({ generated: "1" });
  if (draft.linksRemoved) notes.set("links", String(draft.linksRemoved));
  redirect(`/articles/${created.id}?${notes}`);
}
