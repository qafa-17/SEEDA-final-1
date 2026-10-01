"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changeStatusSchema, saveArticleSchema } from "@/lib/content/article-form";
import { guidelineChecks, type ArticleFields } from "@/lib/content/rules";

export type ActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string>; savedAt?: string };

const val = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

const ARTICLE_FIELDS =
  "id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown, status, updated_at";

/** Re-run the guideline checks for an article and store the results. */
async function refreshChecks(supabase: Awaited<ReturnType<typeof createClient>>, article: ArticleFields & { id: string }) {
  const now = new Date().toISOString();
  const rows = guidelineChecks(article).map((c) => ({
    article_id: article.id,
    rule_key: c.rule_key,
    result: c.result,
    message: c.message,
    checked_at: now,
  }));
  await supabase.from("article_checks").upsert(rows, { onConflict: "article_id,rule_key" });
}

/**
 * Save a draft's details. The database decides who may save (owner or
 * approver, drafts only); this action adds friendly messages and a
 * conflict check so two people can't silently overwrite each other.
 */
export async function saveArticle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveUser();
  const parsed = saveArticleSchema.safeParse({
    id: val(fd, "id"),
    updatedAt: val(fd, "updatedAt"),
    title: val(fd, "title"),
    slug: val(fd, "slug"),
    meta_description: val(fd, "meta_description"),
    content_type_id: val(fd, "content_type_id"),
    service_area_id: val(fd, "service_area_id"),
    target_keyword: val(fd, "target_keyword"),
    author_name: val(fd, "author_name"),
    publish_date: val(fd, "publish_date"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { message: "Some details need fixing before they can be saved.", fieldErrors };
  }
  const { id, updatedAt, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .update(fields)
    .eq("id", id)
    .eq("updated_at", updatedAt) // only if nobody changed it since this page loaded
    .select(ARTICLE_FIELDS);

  if (error) {
    if (error.code === "23505") return { message: "Another article already uses that URL slug. Choose a different one.", fieldErrors: { slug: "Already used by another article." } };
    if (error.code === "23503") return { message: "That type or service area no longer exists. Reload the page and choose again." };
    if (error.code === "23514") return { message: "One of the details is in a format the site can't accept. Check the highlighted fields." };
    return { message: "Couldn't save. Please try again." };
  }

  if (!data || data.length === 0) {
    // Nothing was updated: work out why, in plain language.
    const { data: current } = await supabase.from("articles").select("status, updated_at").eq("id", id).maybeSingle();
    if (!current) return { message: "This article no longer exists." };
    if (current.status !== "draft") return { message: "This article has moved out of Draft, so it can't be edited. Reload the page." };
    if (current.updated_at !== updatedAt) return { message: "Someone else changed this article since you opened it. Reload the page to see their changes, then edit again." };
    return { message: "You don't have permission to edit this article." };
  }

  const saved = data[0] as ArticleFields & { id: string; updated_at: string };
  await refreshChecks(supabase, saved);
  revalidatePath(`/articles/${id}`);
  revalidatePath("/board");
  return { ok: true, savedAt: saved.updated_at };
}

/** Submit, approve, request changes, withdraw or reopen. All rules live in the database. */
export async function changeStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveUser();
  const parsed = changeStatusSchema.safeParse({ id: val(fd, "id"), to: val(fd, "to"), note: val(fd, "note") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "That request wasn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_article_status", {
    p_article_id: parsed.data.id,
    p_to: parsed.data.to,
    p_note: parsed.data.note,
  });

  if (error) {
    // These codes carry messages written by us in the database, in plain language.
    const ours = ["23514", "23502", "22023", "42501", "P0002", "22001"];
    return { message: ours.includes(error.code) ? error.message : "Couldn't change the status. Please try again." };
  }

  revalidatePath(`/articles/${parsed.data.id}`);
  revalidatePath("/board");
  revalidatePath("/team");
  return { ok: true };
}

/** Delete a draft (owner or approver). History and checks go with it. */
export async function deleteDraft(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveUser();
  const id = z.uuid().safeParse(val(fd, "id"));
  if (!id.success) return { message: "That request wasn't valid." };
  if (val(fd, "confirm") !== "yes") return { message: "Confirm the deletion first." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").delete().eq("id", id.data).select("id");
  if (error) return { message: "Couldn't delete this draft. Please try again." };
  if (!data || data.length === 0) return { message: "Only the owner or an approver can delete a draft, and only while it's a draft." };

  revalidatePath("/board");
  redirect("/board?deleted=1");
}
