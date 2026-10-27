import { brand } from "@/config/brand";

const stages = [
  { label: "Draft", dot: "bg-status-draft" },
  { label: "In Review", dot: "bg-status-review" },
  { label: "Approved", dot: "bg-status-approved" },
  { label: "Published", dot: "bg-status-published" },
];

/**
 * The picture beside the sign-in forms on wide screens. Drawn with code
 * rather than a photo, so it loads instantly and suits both themes. It is
 * decorative only, hidden from screen readers.
 */
export function ShowcasePanel() {
  return (
    <div
      aria-hidden
      className="relative hidden overflow-hidden rounded-3xl lg:flex lg:flex-col lg:justify-between"
      style={{ background: "linear-gradient(150deg, var(--sidebar) 0%, color-mix(in srgb, var(--sidebar) 70%, #c62a61) 100%)" }}
    >
      {/* Soft light shapes for depth. */}
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#ff7aa5]/25 blur-3xl" />

      <div className="relative p-10 xl:p-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/70">{brand.name}</p>
        <p className="mt-4 max-w-md font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
          From a finished Google Doc to a live, findable page.
        </p>
      </div>

      {/* A small picture of the workflow: one article moving through its stages. */}
      <div className="relative mx-10 mb-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm xl:mx-14 xl:mb-14">
        <p className="text-sm font-semibold text-white">Cost Control on Alberta Pipeline Projects</p>
        <p className="mt-1 text-xs text-white/70">Whitepaper · Pipeline Engineering</p>
        <ol className="mt-5 grid grid-cols-4 gap-2">
          {stages.map((s, i) => (
            <li key={s.label} className="flex flex-col gap-2">
              <span className={`h-1.5 rounded-full ${i < 3 ? "bg-white" : "bg-white/25"}`} />
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/85">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-[#1f1936]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1a7441] text-[10px] text-white">✓</span>
          Ready to submit: everything the site needs is filled in.
        </div>
      </div>
    </div>
  );
}
