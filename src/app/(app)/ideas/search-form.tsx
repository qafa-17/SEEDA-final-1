"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-fields";
import { researchKeyword, type IdeaState } from "./actions";

function Button({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Researching… (up to 30 seconds)" : "Research this keyword"}
    </button>
  );
}

export function SearchForm({
  keywords,
  regions,
  defaultKeyword,
  defaultRegion,
  disabled,
}: {
  keywords: string[];
  regions: { slug: string; label: string }[];
  defaultKeyword: string;
  defaultRegion: string;
  disabled: boolean; // the search service isn't set up
}) {
  const [state, action] = useActionState(researchKeyword, {} as IdeaState);
  const keywordError = state.fieldErrors?.keyword;
  return (
    <form action={action} className="rounded-lg border border-border bg-surface p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div>
          <label htmlFor="keyword" className="text-sm font-medium">Keyword</label>
          <input
            id="keyword"
            name="keyword"
            list="idea-keywords"
            defaultValue={defaultKeyword}
            maxLength={80}
            required
            placeholder="e.g. EPC consulting services"
            aria-invalid={keywordError ? true : undefined}
            aria-describedby={keywordError ? "keyword-error" : undefined}
            className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${keywordError ? "border-danger" : "border-border"}`}
          />
          <datalist id="idea-keywords">
            {keywords.map((k) => <option key={k} value={k} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="region" className="text-sm font-medium">Area</label>
          <select id="region" name="region" defaultValue={defaultRegion} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {regions.map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
          </select>
        </div>
        <Button disabled={disabled} />
      </div>
      {keywordError ? <p id="keyword-error" className="mt-1 text-sm text-danger">{keywordError}</p> : null}
      {state.message ? <div className="mt-3"><FormMessage message={state.message} /></div> : null}
    </form>
  );
}
