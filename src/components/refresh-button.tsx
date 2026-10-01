"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Re-runs the current page on the server (e.g. to see if access was granted).
export function RefreshButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? "Checking…" : children}
    </button>
  );
}
