"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";
import type { FormState } from "@/lib/validation/auth";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

const initial: FormState = {};
const passwordHint = "At least 8 characters, with a letter and a number.";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="firstName" label="First name" autoComplete="given-name" maxLength={50} defaultValue={state.values?.firstName} error={state.fieldErrors?.firstName} />
        <TextField name="lastName" label="Last name (optional)" autoComplete="family-name" maxLength={50} required={false} defaultValue={state.values?.lastName} error={state.fieldErrors?.lastName} />
      </div>
      <TextField name="email" label="Work email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <TextField name="password" label="Password" type="password" autoComplete="new-password" hint={passwordHint} error={state.fieldErrors?.password} />
      <SubmitButton pendingLabel="Creating account…">
        <span className="inline-flex items-center gap-2">
          Create account
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </SubmitButton>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <FormMessage message={state.message} />
      <TextField name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <SubmitButton pendingLabel="Sending link…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <FormMessage message={state.message} />
      <TextField name="password" label="New password" type="password" autoComplete="new-password" hint={passwordHint} error={state.fieldErrors?.password} />
      <TextField name="confirmPassword" label="Type it again" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}
