import Link from "next/link";
import { brand } from "@/config/brand";

// Placeholder mark. Replace with the Session 7 logo (put the file in /public and use next/image).
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display font-semibold text-foreground">
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-md bg-primary text-[11px] tracking-tight text-primary-foreground"
      >
        {brand.shortName}
      </span>
      <span>{brand.name}</span>
    </Link>
  );
}
