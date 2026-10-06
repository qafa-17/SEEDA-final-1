"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-fields";
import { deleteAccount, type DeleteAccountState } from "./actions";

function DeleteButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-danger-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete my account"}
    </button>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, {} as DeleteAccountState);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">
        This permanently removes your sign-in, name and role. Articles you own stay on the dashboard, shown as owned by a former
        member. You can sign up again later with the same email; you&apos;ll start in the waiting room.
      </p>
      <FormMessage message={state.message} />
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2"
        />
      </div>
      <DeleteButton ready={typed.trim() === "DELETE"} />
    </form>
  );
}
