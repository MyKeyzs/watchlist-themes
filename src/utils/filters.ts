import { WatchItem } from "./types";

export const splitThemes = (s: string) =>
  (s || "")
    .split(/[,|]/)
    .map(x => x.trim())
    .filter(Boolean);

export function computeThemesForDates(
  dates: Set<string>,
  themesByDate: Map<string, Set<string>>
): string[] {
  const out = new Set<string>();
  for (const d of dates) {
    const set = themesByDate.get(d);
    if (set) for (const t of set) out.add(t);
  }
  return Array.from(out);
}

export function sortRows(rows: WatchItem[], sort: { key: keyof WatchItem; dir: "asc"|"desc" } | null) {
  if (!sort) return rows;
  const { key, dir } = sort;
  return rows.slice().sort((a, b) => {
    const av = String(a[key] ?? "").toLowerCase();
    const bv = String(b[key] ?? "").toLowerCase();
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}
