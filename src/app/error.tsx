"use client";

// Catches unexpected errors in any page so the user sees a recovery option, not a blank screen.
// The raw error message is deliberately not shown (it can leak internal details).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">Nothing you entered was lost. Try again, and if it keeps happening, tell the site owner.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
