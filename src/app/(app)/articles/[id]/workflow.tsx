"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-fields";
import { changeStatus, type ActionState } from "./actions";

type Move = { to: "draft" | "approved"; label: string; pendingLabel: string; needsNote: boolean; notePrompt?: string; tone: "primary" | "neutral" };

function Submit({ label, pendingLabel, tone, disabled }: { label: string; pendingLabel: string; tone: "primary" | "neutral"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const tones = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    neutral: "border border-border bg-surface hover:bg-border/40",
  };
  return (
    <button type="submit" disabled={pending || disabled} className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function MoveForm({ id, move, onCancel }: { id: string; move: Move; onCancel?: () => void }) {
  const [state, action] = useActionState(changeStatus, {} as ActionState);
  const [note, setNote] = useState("");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={move.to} />
      {move.needsNote ? (
        <div>
          <label htmlFor={`note-${move.to}`} className="block text-sm font-medium">{move.notePrompt}</label>
          <textarea
            id={`note-${move.to}`}
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <input type="hidden" name="note" value="" />
      )}
      <div className="flex flex-wrap gap-2">
        <Submit label={move.label} pendingLabel={move.pendingLabel} tone={move.tone} disabled={move.needsNote && note.trim() === ""} />
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">
            Cancel
          </button>
        ) : null}
      </div>
      <FormMessage message={state.message} />
    </form>
  );
}

/** The buttons for an article that is In Review or Approved. */
export function WorkflowActions({
  id,
  status,
  isApprover,
  isOwner,
}: {
  id: string;
  status: "in_review" | "approved";
  isApprover: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const moves: Move[] = [];
  if (status === "in_review") {
    if (isApprover) moves.push({ to: "approved", label: "Approve", pendingLabel: "Approving…", needsNote: false, tone: "primary" });
    if (isApprover && !isOwner)
      moves.push({ to: "draft", label: "Request changes", pendingLabel: "Sending back…", needsNote: true, notePrompt: "What needs to change?", tone: "neutral" });
    if (isOwner) moves.push({ to: "draft", label: "Withdraw to draft", pendingLabel: "Withdrawing…", needsNote: false, tone: "neutral" });
  } else if (isApprover || isOwner) {
    moves.push({ to: "draft", label: "Reopen for edits", pendingLabel: "Reopening…", needsNote: true, notePrompt: "Why is it being reopened?", tone: "neutral" });
  }

  if (moves.length === 0) {
    return (
      <p className="text-sm text-muted">
        {status === "in_review" ? "Waiting for an approver to review it." : "Approved. Only the owner or an approver can reopen it."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {moves.map((m) =>
          m.needsNote ? (
            open === m.label ? null : (
              <button key={m.label} type="button" onClick={() => setOpen(m.label)} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40">
                {m.label}
              </button>
            )
          ) : (
            <MoveForm key={m.label} id={id} move={m} />
          ),
        )}
      </div>
      {moves.filter((m) => m.needsNote && open === m.label).map((m) => (
        <div key={m.label} className="rounded-md border border-border bg-background p-3">
          <MoveForm id={id} move={m} onCancel={() => setOpen(null)} />
        </div>
      ))}
    </div>
  );
}
