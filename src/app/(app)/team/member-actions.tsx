"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changeMember, type TeamActionState } from "./actions";

type Change = { kind: "access" | "role"; value: string; label: string; tone: "primary" | "neutral" | "danger" };

function ActionButton({ change, pendingLabel }: { change: Change; pendingLabel: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("kind") === change.kind && data?.get("value") === change.value;
  const tones = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    neutral: "border border-border hover:bg-border/40",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-60 ${tones[change.tone]}`}
    >
      {mine ? pendingLabel : change.label}
    </button>
  );
}

// One small form per button, so each sends exactly one change.
export function MemberActions({ userId, changes, name }: { userId: string; changes: Change[]; name: string }) {
  const [state, action] = useActionState(changeMember, {} as TeamActionState);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {changes.map((c) => (
          <form key={`${c.kind}-${c.value}`} action={action} aria-label={`${c.label}: ${name}`}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="kind" value={c.kind} />
            <input type="hidden" name="value" value={c.value} />
            <ActionButton change={c} pendingLabel="Saving…" />
          </form>
        ))}
      </div>
      {state.message ? (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
