import Link from "next/link";
import { brand } from "@/config/brand";

// The mark: a capital S inside a rectangle.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="6" className="fill-primary" />
      <rect x="4" y="4" width="24" height="24" rx="3" fill="none" className="stroke-primary-foreground" strokeOpacity="0.35" strokeWidth="1.5" />
      <text
        x="16"
        y="23"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        className="fill-primary-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        S
      </text>
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-display text-lg font-bold text-foreground">
      <LogoMark />
      <span>{brand.name}</span>
    </Link>
  );
}
