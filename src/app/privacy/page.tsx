import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy" };

const UPDATED = "October 6, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

// Public page: what the app stores about a person and why. Every statement
// here describes what the code actually does; update both together.
export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-border/60">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Privacy</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
        <p className="mt-4 text-sm leading-relaxed">
          {brand.name} is a private workspace where a small team prepares articles for publication. It was built as a
          university course project. This page explains, in plain language, what the workspace stores about you and what
          it does with it.
        </p>

        <Section title="What is stored about you">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Your name and email address</strong>, which you give when you create an account or which Google provides when you choose &quot;Continue with Google&quot;.</li>
            <li><strong>Your role and access</strong> in the workspace (publisher or approver; waiting, active or removed).</li>
            <li><strong>Your work</strong>: the articles you import or edit, the keywords you add or suggest, the research you run, and a history of who submitted, approved or changed each article.</li>
          </ul>
          <p>
            If you sign in with Google, the workspace receives only your basic profile: name, email address and profile
            picture address. It does not receive your Google password, contacts, Gmail or personal Drive files. The
            profile picture is not shown or used.
          </p>
          <p>If you sign up with a password, it is stored only in scrambled (hashed) form by the sign-in service. Nobody, including the people who run the workspace, can read it.</p>
        </Section>

        <Section title="What it is used for">
          <p>
            To sign you in, to show your teammates who owns and approved each article, and to keep a record of changes.
            Nothing else. Your information is not sold, not used for advertising, and not shared with anyone outside
            the services listed below.
          </p>
        </Section>

        <Section title="Cookies and tracking">
          <p>
            The workspace sets one kind of cookie: the one that keeps you signed in. Your choice of light or dark theme
            is remembered in your own browser. There are no analytics, advertising or tracking scripts, and the pages
            load nothing from third-party sites.
          </p>
        </Section>

        <Section title="Services the workspace relies on">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Supabase</strong> stores the database and handles sign-in.</li>
            <li><strong>Vercel</strong> hosts the website.</li>
            <li><strong>Google</strong> provides &quot;Continue with Google&quot;, delivers account emails, and holds the one shared Drive folder the workspace reads articles from.</li>
            <li><strong>Tavily</strong> (web search) and <strong>Google Gemini</strong> (AI summaries) receive the keyword and area you research, and the public search results for it. They are not sent your name, email address or any other personal information.</li>
          </ul>
        </Section>

        <Section title="Seeing, changing and deleting your information">
          <p>
            You can change your name at any time under Settings. You can delete your account there too: this removes
            your sign-in, name and role straight away. Articles and research you worked on stay in the workspace for
            the team, shown as belonging to a former member, with no name attached.
          </p>
          <p>An approver can remove a person&apos;s access at any time.</p>
        </Section>

        <Section title="Questions">
          <p>
            Ask the workspace administrator who approved your access. If you were never given access and want your
            sign-up removed, sign in and choose &quot;Delete this account&quot; on the waiting page.
          </p>
        </Section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted">
          {brand.name} · <Link href="/" className="underline underline-offset-2">Home</Link>
        </div>
      </footer>
    </>
  );
}
