"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { PiCheckCircleFill, PiCircleBold, PiSpinnerGapBold, PiWarningCircleFill } from "react-icons/pi";
import { FormMessage } from "@/components/form-fields";
import { checkPublished, publishArticle, type PublishState } from "./publish-actions";

export type LatestJob = { id: string; state: "queued" | "pr_open" | "merged" | "verified" | "failed"; pr_url: string | null; error_message: string | null } | null;

function PublishButton({ again }: { again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Publishing… (about 15 seconds)" : again ? "Try publishing again" : "Publish to the website"}
    </button>
  );
}

const STEPS = [
  { key: "pr", label: "Pull request opened on GitHub" },
  { key: "merged", label: "Merged into the website" },
  { key: "live", label: "Website rebuilt, page is live and in the sitemap" },
] as const;

/**
 * Publishing, for an approved article: one button, then the three steps as
 * they happen. While the website rebuilds, the page checks every 10 seconds
 * and reloads itself once the article is live.
 */
export function PublishPanel({ articleId, job, siteUrl, slug, configured }: { articleId: string; job: LatestJob; siteUrl: string; slug: string; configured: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState(publishArticle, {} as PublishState);
  const [waitNote, setWaitNote] = useState<string | undefined>();
  const waiting = job?.state === "merged";

  useEffect(() => {
    if (!waiting || !job) return;
    let stopped = false;
    const tick = async () => {
      const r = await checkPublished(job.id);
      if (stopped) return;
      if (r.done) router.refresh();
      else setWaitNote(r.message);
    };
    const first = setTimeout(tick, 4000);
    const every = setInterval(tick, 10_000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(every);
    };
  }, [waiting, job, router]);

  const reached = job ? { queued: 0, pr_open: 1, merged: 2, verified: 3, failed: -1 }[job.state] : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Publishing adds this article to the website as <code className="text-xs">/resources/{slug}</code> on{" "}
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{siteUrl.replace(/^https:\/\//, "")}</a>.
        What was approved is exactly what goes live.
      </p>

      {job && job.state !== "failed" ? (
        <ol className="space-y-2 text-sm" aria-live="polite">
          {STEPS.map((s, i) => {
            const done = reached > i;
            const current = reached === i && waiting;
            return (
              <li key={s.key} className="flex items-center gap-2">
                {done ? <PiCheckCircleFill aria-hidden className="h-5 w-5 text-success" /> : current ? <PiSpinnerGapBold aria-hidden className="h-5 w-5 animate-spin text-primary" /> : <PiCircleBold aria-hidden className="h-5 w-5 text-muted" />}
                <span className={done ? "" : "text-muted"}>
                  {s.label}
                  {s.key === "pr" && job.pr_url ? (
                    <>
                      {" · "}
                      <a href={job.pr_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">view it</a>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {waiting ? <p className="text-xs text-muted">{waitNote ?? "Waiting for the website to rebuild…"} This page updates by itself.</p> : null}

      {job?.state === "failed" ? (
        <div className="flex gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
          <PiWarningCircleFill aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="font-medium">The last attempt didn&apos;t finish</p>
            <p className="mt-0.5 text-muted">{job.error_message}</p>
            {job.pr_url ? <a href={job.pr_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-primary underline underline-offset-2">See the pull request</a> : null}
          </div>
        </div>
      ) : null}

      {!job || job.state === "failed" ? (
        configured ? (
          <form action={action}>
            <input type="hidden" name="id" value={articleId} />
            <PublishButton again={job?.state === "failed"} />
          </form>
        ) : (
          <FormMessage message="Publishing isn't connected yet. An admin needs to add the GitHub token in Vercel." />
        )
      ) : null}
      <FormMessage tone={state.ok ? "success" : "error"} message={state.message} />
    </div>
  );
}
