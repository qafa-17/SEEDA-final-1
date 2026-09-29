import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";

// Shared frame for every signed-in page. Stage 2 adds the session check here.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-border bg-surface p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-4">
          <Logo href="/board" />
        </div>
        <AppNav />
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
