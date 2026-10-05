"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type KeywordState = { ok?: boolean; message?: string };

const newKeyword = z.object({
  phrase: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Type a keyword of at least 2 characters.")
        .max(80, "Keep the keyword under 80 characters.")
        .regex(/^[^*%_\\<>]+$/, "Use letters, numbers and ordinary punctuation only."),
    ),
  categoryId: z.coerce.number().int().positive("Choose a group."),
});

/**
 * Approvers add a keyword to the list; publishers suggest one for an
 * approver to accept. The database enforces the same rule, so a publisher
 * cannot add directly even with a hand-made request.
 */
export async function addKeyword(_prev: KeywordState, fd: FormData): Promise<KeywordState> {
  const user = await requireActiveUser();
  const parsed = newKeyword.safeParse({ phrase: String(fd.get("phrase") ?? ""), categoryId: String(fd.get("categoryId") ?? "") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "That keyword wasn't valid." };

  const status = user.role === "approver" ? "active" : "suggested";
  const supabase = await createClient();
  const { error } = await supabase.from("keywords").insert({ phrase: parsed.data.phrase, category_id: parsed.data.categoryId, status });
  if (error) {
    if (error.code === "23505") return { message: "That keyword is already on the list or already suggested." };
    if (error.code === "23503") return { message: "That group no longer exists. Reload the page and choose again." };
    if (error.code === "42501") return { message: "Your account can't add keywords." };
    return { message: "Couldn't save the keyword. Please try again." };
  }
  revalidatePath("/keywords");
  return { ok: true, message: status === "active" ? `Added "${parsed.data.phrase}" to the list.` : `Suggested "${parsed.data.phrase}". An approver will review it.` };
}

const review = z.object({ id: z.coerce.number().int().positive(), decision: z.enum(["accept", "remove"]) });

/** Approvers only: accept a suggestion, dismiss it, or remove an unused keyword. */
export async function reviewKeyword(_prev: KeywordState, fd: FormData): Promise<KeywordState> {
  const user = await requireActiveUser();
  if (user.role !== "approver") return { message: "Only approvers can change the keyword list." };
  const parsed = review.safeParse({ id: String(fd.get("id") ?? ""), decision: String(fd.get("decision") ?? "") });
  if (!parsed.success) return { message: "That request wasn't valid." };

  const supabase = await createClient();
  if (parsed.data.decision === "accept") {
    const { data, error } = await supabase.from("keywords").update({ status: "active" }).eq("id", parsed.data.id).eq("status", "suggested").select("id");
    if (error) return { message: "Couldn't accept the suggestion. Please try again." };
    if (!data?.length) return { message: "That suggestion was already handled. Reload the page." };
  } else {
    // A keyword that articles already target stays, so their coverage isn't lost.
    const { data: used } = await supabase.rpc("articles_for_keyword", { p_keyword_id: parsed.data.id });
    const { data: row } = await supabase.from("keywords").select("status").eq("id", parsed.data.id).maybeSingle();
    if (!row) return { message: "That keyword is already gone. Reload the page." };
    if (row.status === "active" && (used ?? []).length > 0) return { message: "Articles target this keyword, so it can't be removed." };
    const { data, error } = await supabase.from("keywords").delete().eq("id", parsed.data.id).select("id");
    if (error || !data?.length) return { message: "Couldn't remove the keyword. Please try again." };
  }
  revalidatePath("/keywords");
  return { ok: true };
}
