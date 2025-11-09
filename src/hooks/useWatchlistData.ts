// src/hooks/useWatchlistData.ts
import { useEffect, useMemo, useState } from "react";
import { WatchItem } from "../utils/types";
import { splitThemes } from "../utils/filters";

function coerceString(v: any): string {
  return (v ?? "").toString().trim();
}

export function useWatchlistData(csvUrl: string) {
  const [rows, setRows] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const Papa = (await import("papaparse")).default;
        const res  = await fetch(csvUrl, { cache: "no-cache" });
        const text = await res.text();
        if (aborted) return;

        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const raw = (parsed.data as any[]) ?? [];

        const rs: WatchItem[] = raw.map((r) => {
          // Gather all columns that look like "Theme", "Theme 1", "Theme_2", etc.
          const themeCols = Object.keys(r).filter((k) => /^theme/i.test(k));
          let themes = "";

          if (themeCols.length > 0) {
            const vals = themeCols
              .map((k) => coerceString(r[k]))
              .filter(Boolean);
            themes = vals.join(" | "); // canonical internal delimiter
          } else {
            // fallback to a single column if present
            themes = coerceString(r["Theme(s)"] ?? r["Themes"] ?? r["Theme"]);
          }

          // Date header variations we might see
          const dateAnalyzed =
            coerceString(
              r["Date analyzed"] ??
                r["Date Analyzed"] ??
                r["Date_Analyzed"] ??
                r["Analyzed Date"]
            );

          return {
            Ticker:            coerceString(r.Ticker ?? r.Symbol),
            Company:           coerceString(r.Company ?? r.Name),
            "Theme(s)":        themes,
            "Thesis Snapshot": coerceString(r["Thesis Snapshot"] ?? r.Thesis),
            "Key 2026 Catalysts":
              coerceString(r["Key 2026 Catalysts"] ?? r.Catalysts),
            "What Moves It (Triggers)":
              coerceString(r["What Moves It (Triggers)"] ?? r["What Moves It"]),
            "Catalyst Path":   coerceString(r["Catalyst Path"]),
            Notes:             coerceString(r.Notes ?? r.Note),
            "Date analyzed":   dateAnalyzed,
          } as WatchItem;
        });

        setRows(rs);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Failed to load CSV");
      } finally {
        setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [csvUrl]);

  // distinct set of themes (from any source format)
  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap(r => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );

  // distinct dates (string sort by month/day as before)
  const uniqueDates = useMemo(() => {
    const dates = Array.from(
      new Set(rows.map(r => (r["Date analyzed"] || "").trim()).filter(Boolean))
    );
    const toNum = (d: string) => {
      const m = d.match(/^(\d{1,2})[\/\-](\d{1,2})/);
      if (!m) return Number.MAX_SAFE_INTEGER;
      return Number(m[1]) * 100 + Number(m[2]);
    };
    return dates.sort((a, b) => toNum(b) - toNum(a));
  }, [rows]);

  // themes grouped by date for the date-filter auto-select
  const themesByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const d = (r["Date analyzed"] || "").trim();
      if (!d) continue;
      const set = map.get(d) ?? new Set<string>();
      for (const t of splitThemes(r["Theme(s)"])) set.add(t);
      map.set(d, set);
    }
    return map;
  }, [rows]);

  return { rows, loading, error, allThemes, uniqueDates, themesByDate };
}