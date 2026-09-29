// An honest marker for features that arrive in a later build stage,
// so nothing on the page pretends to work when it doesn't yet.
export function StageNotice({ stage, children }: { stage: number; children: React.ReactNode }) {
  return (
    <p role="note" className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
      <strong className="font-semibold">Coming in stage {stage}.</strong> {children}
    </p>
  );
}
