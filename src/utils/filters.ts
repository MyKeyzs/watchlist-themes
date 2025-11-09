// src/utils/filters.ts
import { WatchItem, SortState } from "./types";

/** Split the Theme(s) cell into normalized theme tokens. */
export function splitThemes(raw: string | undefined | null): string[] {
  if (!raw) return [];
  // split on comma, slash, or semicolon, trim, drop empties, de-dupe
  const parts = String(raw)
    .split(/[\/,;]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  return Array.from(new Set(parts));
}

/**
 * Given a set of selected dates and a map date -> Set(themes),
 * return a sorted list of unique themes covered by those dates.
 */
export function computeThemesForDates(
  dates: Set<string>,
  themesByDate: Map<string, Set<string>>
): string[] {
  const acc = new Set<string>();
  for (const d of dates) {
    const s = themesByDate.get(d);
    if (!s) continue;
    for (const t of s) acc.add(t);
  }
  return Array.from(acc).sort((a, b) => a.localeCompare(b));
}

/** Generic sorter for table rows using the SortState. */
export function sortRows(rows: WatchItem[], sort: SortState): WatchItem[] {
  const { key, dir } = sort;
  const data = rows.slice();

  data.sort((a, b) => {
    // number-like columns don’t exist (yet), so do string compare
    const av = String((a as any)[key] ?? "").toLowerCase();
    const bv = String((b as any)[key] ?? "").toLowerCase();

    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });

  return data;
}
