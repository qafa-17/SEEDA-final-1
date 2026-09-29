import Link from "next/link";
import { StageNotice } from "@/components/stage-notice";

type Field = { name: string; label: string; type: string; autoComplete: string };

// Layout of the real form, shown disabled until Supabase Auth is wired in stage 2.
export function AuthFormPreview({
  title,
  fields,
  submitLabel,
  footer,
}: {
  title: string;
  fields: Field[];
  submitLabel: string;
  footer: { text: string; href: string; linkLabel: string };
}) {
  return (
    <>
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <div className="mt-4">
        <StageNotice stage={2}>Accounts open once sign-in is connected to Supabase.</StageNotice>
      </div>
      <form className="mt-5 space-y-4">
        <fieldset disabled className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="block text-sm font-medium">
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ))}
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </fieldset>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {footer.text}{" "}
        <Link href={footer.href} className="font-medium text-foreground underline underline-offset-2">
          {footer.linkLabel}
        </Link>
      </p>
    </>
  );
}
