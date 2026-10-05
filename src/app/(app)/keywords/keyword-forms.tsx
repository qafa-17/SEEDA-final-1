"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addKeyword, reviewKeyword, type KeywordState } from "./actions";

function Submit({ label, pendingLabel, tone = "primary" }: { label: string; pendingLabel: string; tone?: "primary" | "neutral" | "danger" }) {
  const { pending } = useFormStatus();
  const tones = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    neutral: "border border-border hover:bg-border/40",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
  };
  return (
    <button type="submit" disabled={pending} className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Approvers add straight to the list; publishers send a suggestion. */
export function AddKeywordForm({ categories, isApprover }: { categories: { id: number; name: string }[]; isApprover: boolean }) {
  const [state, action] = useActionState(addKeyword, {} as KeywordState);
  return (
    <form action={action} key={state.ok ? state.message : "form"} className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-semibold">{isApprover ? "Add a keyword" : "Suggest a keyword"}</h2>
      <p className="mt-1 text-xs text-muted">
        {isApprover ? "It joins the list straight away and appears as a suggestion in the article editor." : "An approver reviews suggestions before they join the list."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_16rem_auto] sm:items-end">
        <div>
          <label htmlFor="new-keyword" className="text-sm font-medium">Keyword</label>
          <input id="new-keyword" name="phrase" required maxLength={80} placeholder="e.g. Owner's engineer services" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="new-keyword-group" className="text-sm font-medium">Group</label>
          <select id="new-keyword-group" name="categoryId" required defaultValue="" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="" disabled>Choose a group</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Submit label={isApprover ? "Add keyword" : "Send suggestion"} pendingLabel="Saving…" />
      </div>
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={`mt-3 text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}

/** One or two small buttons for an approver, each sending exactly one decision. */
export function ReviewButtons({ id, phrase, decisions }: { id: number; phrase: string; decisions: ("accept" | "dismiss" | "remove")[] }) {
  const [state, action] = useActionState(reviewKeyword, {} as KeywordState);
  const meta = {
    accept: { label: "Accept", value: "accept", tone: "primary" as const },
    dismiss: { label: "Dismiss", value: "remove", tone: "neutral" as const },
    remove: { label: "Remove", value: "remove", tone: "danger" as const },
  };
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-2">
        {decisions.map((d) => (
          <form key={d} action={action} aria-label={`${meta[d].label}: ${phrase}`}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value={meta[d].value} />
            <Submit label={meta[d].label} pendingLabel="Saving…" tone={meta[d].tone} />
          </form>
        ))}
      </span>
      {state.message ? <span role="alert" className="max-w-xs text-right text-xs text-danger">{state.message}</span> : null}
    </span>
  );
}
