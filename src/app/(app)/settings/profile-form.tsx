"use client";

import { useActionState } from "react";
import { FormMessage, TextField } from "@/components/form-fields";
import type { FormState } from "@/lib/validation/auth";
import { updateProfile } from "../../(auth)/actions";
import { useFormStatus } from "react-dom";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save name"}
    </button>
  );
}

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, {} as FormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <FormMessage tone="success" message={state.success} />
      <TextField
        name="fullName"
        label="Full name"
        autoComplete="name"
        maxLength={100}
        defaultValue={state.values?.fullName ?? fullName}
        error={state.fieldErrors?.fullName}
      />
      <SaveButton />
    </form>
  );
}
