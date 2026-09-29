// Single place for product identity.
export const brand = {
  name: "Content Operations",
  shortName: "S",
  tagline: "From a finished Google Doc to a live, findable Knowledge Hub page.",
  client: "EPCMst",
} as const;

// Main navigation for signed-in pages. Every entry must point to a real page.
export const appNav = [
  { href: "/board", label: "Board", description: "Every article and where it stands" },
  { href: "/import", label: "Import from Drive", description: "Bring in a finished Google Doc" },
  { href: "/settings", label: "Settings", description: "Your account and workspace" },
] as const;
