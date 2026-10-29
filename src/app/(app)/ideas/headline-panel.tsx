"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PiArrowRightBold, PiLightbulbBold, PiPenNibBold, PiSparkleBold } from "react-icons/pi";
import { FormMessage } from "@/components/form-fields";
import { LIMITS } from "@/lib/content/rules";
import type { Headline } from "@/lib/drafts/headlines";
import { suggestHeadlines, writeDraft, type DraftActionState } from "./draft-actions";

function Submit({ label, pendingLabel, primary, disabled }: { label: string; pendingLabel: string; primary?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        primary ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border bg-surface hover:bg-border/40"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function SuggestForm({ searchId, again, disabled }: { searchId: string; again: boolean; disabled: boolean }) {
  const [state, action] = useActionState(suggestHeadlines, {} as DraftActionState);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="searchId" value={searchId} />
      <Submit label={again ? "Suggest new headlines" : "Suggest headlines"} pendingLabel="Thinking of headlines… (about 15 seconds)" primary={!again} disabled={disabled} />
      <FormMessage message={state.message} />
    </form>
  );
}

function WriteForm({ requestId, index, disabled }: { requestId: string; index: number; disabled: boolean }) {
  const [state, action] = useActionState(writeDraft, {} as DraftActionState);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="index" value={index} />
      <Submit label="Write this draft" pendingLabel="Writing the draft… (up to a minute)" primary disabled={disabled} />
      <FormMessage message={state.message} />
    </form>
  );
}

/**
 * Generate draft, under a piece of research: suggest headlines, then pick
 * one to have the full draft written. The draft opens in the editor as an
 * ordinary draft, marked "AI draft", and goes through the usual review.
 */
export function HeadlinePanel({
  searchId,
  saved,
  areaLabels,
  typeLabels,
  allowance,
  disabled,
}: {
  searchId: string;
  saved: { requestId: string; headlines: Headline[]; byline: string } | null;
  areaLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  allowance: string;
  disabled: boolean;
}) {
  return (
    <section id="headlines" aria-labelledby="headlines-title" className="mt-6 scroll-mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h3 id="headlines-title" className="flex items-center gap-2 font-semibold">
            <PiSparkleBold aria-hidden className="text-accent" /> Turn this into an article
          </h3>
          <p className="mt-1 text-sm text-muted">
            {saved
              ? `Headlines ${saved.byline}. Pick one to have the full draft written in the style of EPCMst's published article. It opens in the editor as a draft for you to check and edit.`
              : "The AI suggests headlines for this keyword, each matched to a keyword from the list, a service and a content type. Pick one and it writes the full draft for you to check and edit."}
          </p>
        </div>
        <SuggestForm searchId={searchId} again={Boolean(saved)} disabled={disabled} />
      </div>

      {saved ? (
        <ol className="mt-5 grid gap-3">
          {saved.headlines.map((h, i) => (
            <li key={i} className={`rounded-lg border p-4 ${h.planned ? "border-accent/40 bg-accent/5" : "border-border bg-background/50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  {h.planned ? (
                    <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      <PiLightbulbBold aria-hidden /> Planned by the owner
                    </p>
                  ) : null}
                  <p className="font-display font-semibold">
                    {h.title}
                    <span className={`ml-2 whitespace-nowrap text-xs font-normal ${h.title.length > LIMITS.titleMax ? "text-warning" : "text-muted"}`}>
                      {h.title.length} / {LIMITS.titleMax}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{h.angle}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{h.keyword}</span>
                    {h.extra_keywords.map((k) => (
                      <span key={k} className="rounded-full border border-border px-2 py-0.5 text-muted">{k}</span>
                    ))}
                    <PiArrowRightBold aria-hidden className="text-muted" />
                    <span className="text-muted">
                      {(h.service_area && areaLabels[h.service_area]) || "Service to choose"} · {typeLabels[h.content_type] ?? "Blog Post"}
                    </span>
                  </p>
                </div>
                <WriteForm requestId={saved.requestId} index={i} disabled={disabled} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
        <PiPenNibBold aria-hidden className="mt-0.5 shrink-0" />
        <span>
          {allowance} Drafts follow the owner&apos;s rules: 900 to 1,200 words, no client names or prices, and numbers only with a linked source. A person always checks the draft before it is submitted.
        </span>
      </p>
    </section>
  );
}
