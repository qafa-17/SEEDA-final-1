"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { articleFile } from "@/lib/publish/file";
import { PublishError, checkLive, isPublishConfigured, publishErrorMessage, publishFile, publishTarget } from "@/lib/publish/github";

export type PublishState = { ok?: boolean; message?: string; done?: boolean };

/** How long to wait for the site to rebuild before calling the attempt failed. */
const WAIT_MINUTES = 10;

// Messages written in the database functions, in plain language.
const OURS = ["23514", "22023", "42501", "P0002", "55P03"];

/**
 * Publish an approved article: write its file, add it to the website's
 * repository through a pull request, and merge it. The site then rebuilds;
 * checkPublished confirms the page is live before the article is marked
 * Published.
 */
export async function publishArticle(_prev: PublishState, fd: FormData): Promise<PublishState> {
  const user = await requireActiveUser();
  if (user.role !== "approver") return { message: "Only an approver can publish." };
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return { message: "That request wasn't valid." };
  if (!isPublishConfigured()) return { message: publishErrorMessage(new PublishError("not_configured")) };

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("articles")
    .select("id, title, slug, meta_description, publish_date, author_name, tags, body_markdown, content_types(label)")
    .eq("id", id.data)
    .maybeSingle();
  if (!a) return { message: "This article no longer exists." };

  const { data: job, error } = await supabase.rpc("start_publish", { p_article_id: id.data }).single();
  if (error || !job) return { message: error && OURS.includes(error.code) ? error.message : "Couldn't start publishing. Please try again." };
  const jobId = (job as { id: string }).id;
  const fail = async (message: string) => {
    await supabase.rpc("update_publish_job", { p_job_id: jobId, p_state: "failed", p_error: message });
    revalidatePath(`/articles/${id.data}`);
    return { message };
  };

  let file;
  try {
    file = articleFile({
      title: a.title ?? "",
      slug: a.slug ?? "",
      meta_description: a.meta_description ?? "",
      publish_date: a.publish_date ?? "",
      author_name: a.author_name ?? "",
      tags: (a.tags ?? []) as string[],
      body_markdown: a.body_markdown ?? "",
      category: (a.content_types as unknown as { label: string } | null)?.label ?? "Blog Post",
    });
  } catch {
    return fail("The article's details don't fit the website's format. Reopen it, check the details, and approve it again.");
  }

  try {
    const { site } = publishTarget();
    await publishFile({
      path: file.path,
      content: file.content,
      branchName: `publish/${a.slug}-${jobId.slice(0, 8)}`,
      title: file.frontmatter.title,
      body: `Published from the EPCMst Content Operations hub by ${user.fullName || "an approver"}.\n\nAdds \`${file.path}\`. Once merged, the page goes live at ${site}/resources/${a.slug}.`,
      onOpened: async (pr) => {
        await supabase.rpc("update_publish_job", { p_job_id: jobId, p_state: "pr_open", p_branch: `publish/${a.slug}-${jobId.slice(0, 8)}`, p_pr_number: pr.number, p_pr_url: pr.url });
      },
    });
  } catch (e) {
    return fail(publishErrorMessage(e));
  }

  const { error: mergedError } = await supabase.rpc("update_publish_job", { p_job_id: jobId, p_state: "merged" });
  if (mergedError) return { message: "The change was merged, but the hub couldn't record it. Reload the page." };
  revalidatePath(`/articles/${id.data}`);
  return { ok: true, message: "Merged. The website is rebuilding, which usually takes a minute or two." };
}

/**
 * After the merge: is the page live and in the sitemap yet? If so, the
 * article becomes Published. Called every few seconds by the article page
 * while it waits.
 */
export async function checkPublished(jobId: string): Promise<PublishState> {
  const user = await requireActiveUser();
  if (user.role !== "approver") return {};
  if (!z.uuid().safeParse(jobId).success) return {};

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("publish_jobs")
    .select("id, state, updated_at, article_id, articles(slug)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.state !== "merged") return { done: true };
  const slug = (job.articles as unknown as { slug: string | null } | null)?.slug;
  if (!slug) return { done: true };

  let live;
  let url: string;
  try {
    const { site } = publishTarget();
    url = `${site}/resources/${slug}`;
    live = await checkLive(url, slug);
  } catch (e) {
    return { message: publishErrorMessage(e) };
  }

  if (live.httpStatus === 200 && live.inSitemap) {
    const { error } = await supabase.rpc("finish_publish", { p_job_id: jobId, p_live_url: url, p_http_status: 200, p_in_sitemap: true });
    if (error) return { message: OURS.includes(error.code) ? error.message : "The page is live, but the hub couldn't record it. Reload the page." };
    revalidatePath(`/articles/${job.article_id}`);
    revalidatePath("/dashboard");
    return { ok: true, done: true };
  }

  if (Date.now() - Date.parse(job.updated_at) > WAIT_MINUTES * 60_000) {
    await supabase.rpc("update_publish_job", {
      p_job_id: jobId,
      p_state: "failed",
      p_error: `The page didn't appear on the website within ${WAIT_MINUTES} minutes (${live.httpStatus === 200 ? "it loads but isn't in the sitemap yet" : `the page answered ${live.httpStatus || "nothing"}`}). Check the website's latest deployment in Vercel, then publish again.`,
    });
    revalidatePath(`/articles/${job.article_id}`);
    return { done: true };
  }
  return { message: live.httpStatus === 200 ? "The page loads; waiting for the sitemap." : "Waiting for the website to finish rebuilding…" };
}
