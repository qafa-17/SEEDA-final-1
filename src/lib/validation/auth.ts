import { z } from "zod";

// One set of rules, used on the server for every auth form.
// Messages are written for a non-technical reader.

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address, like name@company.com."));

export const passwordRules = { min: 8, max: 72 } as const;

const newPassword = z
  .string()
  .min(passwordRules.min, `Use at least ${passwordRules.min} characters.`)
  // bcrypt (used by Supabase) ignores anything past 72 bytes.
  .max(passwordRules.max, `Use at most ${passwordRules.max} characters.`)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Include at least one letter and one number.");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
  email,
  password: newPassword,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(passwordRules.max),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match.",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
});

/** Shape returned by every form action, read by the form to show messages. */
export type FormState = {
  message?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Partial<Record<string, string>>;
};

export function toFieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
