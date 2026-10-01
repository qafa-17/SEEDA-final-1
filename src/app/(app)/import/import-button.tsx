"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importDoc, type ImportState } from "./actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Importing…" : "Import"}
    </button>
  );
}

export function ImportButton({ fileId, name }: { fileId: string; name: string }) {
  const [state, action] = useActionState(importDoc, {} as ImportState);
  return (
    <form action={action} className="flex flex-col items-end gap-1" aria-label={`Import ${name}`}>
      <input type="hidden" name="fileId" value={fileId} />
      <Button />
      {state.message ? (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
