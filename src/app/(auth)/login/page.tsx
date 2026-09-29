import type { Metadata } from "next";
import { AuthFormPreview } from "@/components/auth-form-preview";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFormPreview
      title="Sign in"
      submitLabel="Sign in"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      footer={{ text: "No account yet?", href: "/signup", linkLabel: "Create one" }}
    />
  );
}
