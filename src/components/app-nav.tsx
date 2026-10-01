"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/brand";

// Client component only because it needs the current path to highlight the active link.
// The server decides which items this user may see and passes them in.
export function AppNav({ items, badges = {} }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const count = badges[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-border/60 hover:text-foreground"
            }`}
          >
            {item.label}
            {count > 0 ? (
              <span
                className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-foreground"
                aria-label={`${count} waiting`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
