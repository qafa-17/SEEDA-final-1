/**
 * The page numbers to show: always the first two and last two, the current page and
 * its neighbours, and "gap" where numbers are skipped.
 *   pageList(6, 12) -> [1, 2, "gap", 5, 6, 7, "gap", 11, 12]
 */
export function pageList(current: number, last: number): (number | "gap")[] {
  const wanted = new Set<number>([1, 2, last - 1, last, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev === 2) out.push(prev + 1); // a gap of one page is just that page
    else if (p - prev > 2) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}
