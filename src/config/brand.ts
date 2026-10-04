// Single place for product identity.
export const brand = {
  name: "Content Operations",
  shortName: "S",
  tagline: "From a finished Google Doc to a live, findable Knowledge Hub page.",
  client: "EPCMst",
} as const;

// Main navigation for signed-in pages. Every entry must point to a real page.
export type NavItem = { href: string; label: string; approverOnly?: boolean };

export const appNav: NavItem[] = [
  { href: "/board", label: "Board" },
  { href: "/import", label: "Import from Drive" },
  { href: "/keywords", label: "Keywords" },
  { href: "/ideas", label: "Ideas" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];
