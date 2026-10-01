"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_ID, driveErrorMessage, exportDocMarkdown, getFolderDoc } from "@/lib/drive";
import { cleanDocMarkdown, titleFromDocName } from "@/lib/content/convert";
import { guidelineChecks, slugify, type ArticleFields } from "@/lib/content/rules";

export type ImportState = { message?: string };

/**
 * Import one Doc from the Knowledge Hub folder as a new draft owned by the
 * person who clicked. The Doc is only read, never changed.
 */
export async function importDoc(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireActiveUser();
  const fileId = String(fd.get("fileId") ?? "");
  if (!DRIVE_ID.test(fileId)) return { message: "That Doc couldn't be found." };

  const supabase = await createClient();

  // Already imported? Go straight to it instead of making a duplicate.
  const { data: existing } = await supabase.from("articles").select("id").eq("drive_file_id", fileId).maybeSingle();
  if (existing) redirect(`/articles/${existing.id}`);

  let doc, raw;
  try {
    doc = await getFolderDoc(fileId); // refuses Docs outside the shared folder
    raw = await exportDocMarkdown(fileId);
  } catch (e) {
    return { message: driveErrorMessage(e) };
  }

  const title = titleFromDocName(doc.name);
  const converted = cleanDocMarkdown(raw, doc.name);

  // Suggest a URL from the title if nobody uses it yet; otherwise leave it for the publisher.
  let slug: string | null = slugify(title) || null;
  if (slug) {
    const { data: taken } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = null;
  }

  const fields: ArticleFields = {
    title: title || null,
    slug,
    meta_description: null,
    content_type_id: null,
    service_area_id: null,
    target_keyword: null,
    author_name: user.fullName || null,
    publish_date: null,
    body_markdown: converted.markdown,
  };

  const { data: created, error } = await supabase
    .from("articles")
    .insert({ drive_file_id: fileId, drive_modified_at: doc.modifiedTime, ...fields })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      // Someone imported it a moment ago, or the slug was just taken.
      const { data: again } = await supabase.from("articles").select("id").eq("drive_file_id", fileId).maybeSingle();
      if (again) redirect(`/articles/${again.id}`);
      return { message: "That URL was just taken by another article. Try importing again." };
    }
    if (error?.code === "42501") return { message: "Your account can't import articles." };
    return { message: "Couldn't create the draft. Please try again." };
  }

  const now = new Date().toISOString();
  await supabase.from("article_checks").upsert(
    guidelineChecks(fields).map((c) => ({ article_id: created.id, rule_key: c.rule_key, result: c.result, message: c.message, checked_at: now })),
    { onConflict: "article_id,rule_key" },
  );

  revalidatePath("/board");
  revalidatePath("/import");
  const notes = new URLSearchParams({ imported: "1" });
  if (converted.imagesRemoved) notes.set("images", String(converted.imagesRemoved));
  if (converted.truncated) notes.set("truncated", "1");
  redirect(`/articles/${created.id}?${notes}`);
}
