import type { Metadata } from "next";
import { AuthFormPreview } from "@/components/auth-form-preview";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthFormPreview
      title="Create your account"
      submitLabel="Create account"
      fields={[
        { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
        { name: "email", label: "Work email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
      ]}
      footer={{ text: "Already have an account?", href: "/login", linkLabel: "Sign in" }}
    />
  );
}
