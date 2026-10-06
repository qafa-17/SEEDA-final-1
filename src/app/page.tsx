import Link from "next/link";
import { Logo } from "@/components/logo";
import { brand } from "@/config/brand";

const stepColors = ["text-status-draft", "text-status-review", "text-status-approved", "text-status-published"];

const steps = [
  { title: "Pick a Doc", body: "Choose a finished article from the shared Google Drive folder. Writing stays in Docs." },
  { title: "Fill the details", body: "Title, slug, meta description, type and keyword, checked as you type, in plain language." },
  { title: "Get approval", body: "Send it for review. The approver sees exactly what passed and what needs a fix." },
  { title: "Publish and verify", body: "One click opens the change on the site. The hub confirms the page is live and in the sitemap." },
];

export default function Home() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-2 font-medium hover:bg-border/60">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground hover:opacity-90"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">For content teams</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight md:text-5xl">
            Publish a finished article without calling a developer.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{brand.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90"
            >
              Open the dashboard
            </Link>
            <Link href="#how-it-works" className="rounded-md border border-border bg-surface px-5 py-3 font-medium hover:bg-border/40">
              How it works
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-2xl font-bold">How it works</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-border p-5">
                  <span className={`font-display text-sm font-semibold ${stepColors[i]}`}>Step {i + 1}</span>
                  <h3 className="mt-1 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted">
          {brand.name} · ENTR 3360
        </div>
      </footer>
    </>
  );
}
