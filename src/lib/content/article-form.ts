import { z } from "zod";
import { LIMITS, SLUG_PATTERN, TAG_PATTERN, parseTags } from "./rules";

// Format rules for SAVING a draft. They match the database's column checks,
// so a save never fails on a format the form could have caught. Missing
// values are fine here: completeness is only required to submit.

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max, tooLong))
    .transform((s) => (s === "" ? null : s));

const optionalId = z
  .string()
  .transform((s) => (s === "" ? null : Number(s)))
  .pipe(z.number().int().positive().nullable());

export const saveArticleSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string().min(1),
  title: optionalText(200, "Keep the title under 200 characters."),
  slug: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(
      z
        .string()
        .max(80, "Keep the URL slug to 80 characters or fewer.")
        .refine((s) => s === "" || SLUG_PATTERN.test(s), "Use lowercase letters, numbers and single hyphens only, like modular-construction-guide."),
    )
    .transform((s) => (s === "" ? null : s)),
  meta_description: optionalText(300, "Keep the meta description under 300 characters."),
  content_type_id: optionalId,
  service_area_id: optionalId,
  target_keyword: optionalText(80, "Keep the keyword under 80 characters."),
  // Up to two more keywords, each in its own box. Blank boxes are dropped.
  secondary_keywords: z
    .array(z.string().transform((s) => s.trim()))
    .max(LIMITS.maxSecondaryKeywords)
    .transform((ks) => [...new Map(ks.filter(Boolean).map((k) => [k.toLowerCase(), k])).values()])
    .pipe(z.array(z.string().min(LIMITS.keywordMin, "Keywords need at least 2 characters.").max(LIMITS.keywordMax, "Keep each keyword under 80 characters."))),
  // Typed as one comma-separated line; tidied to lowercase and de-duplicated.
  tags: z
    .string()
    .max(400, "That's too many tags.")
    .transform(parseTags)
    .pipe(
      z
        .array(z.string().regex(TAG_PATTERN, "Tags are 2 to 30 characters: letters, numbers, spaces, & and hyphens."))
        .max(LIMITS.maxTags, `Use ${LIMITS.maxTags} tags or fewer.`),
    ),
  author_name: optionalText(100, "Keep the author name under 100 characters."),
  publish_date: z
    .string()
    .trim()
    .refine((s) => s === "" || (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))), "Pick a valid date.")
    .transform((s) => (s === "" ? null : s)),
});

export type SaveArticleInput = z.infer<typeof saveArticleSchema>;

export const changeStatusSchema = z.object({
  id: z.uuid(),
  to: z.enum(["draft", "in_review", "approved"]),
  note: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1000 characters.")
    .transform((s) => (s === "" ? null : s)),
});
