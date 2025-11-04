import { useEffect, useMemo, useState } from "react";
import { WatchItem } from "../utils/types";
import { splitThemes } from "../utils/filters";

// --- helper: "10/29" -> "2025-10-29" (assume current year; customize if needed)
function normalizeToYYYYMMDD(md: string, fallbackYear = new Date().getFullYear()): string | null {
  if (!md) return null;
  const m = md.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const mm = String(m[1]).padStart(2, "0");
  const dd = String(m[2]).padStart(2, "0");
  return `${fallbackYear}-${mm}-${dd}`;
}

export function useWatchlistData(csvUrl: string) {
  const [rows, setRows] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Load CSV
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
        const rs = (parsed.data as any[]).map(r => ({
          Ticker: (r.Ticker ?? "").trim(),
          Company: (r.Company ?? "").trim(),
          "Theme(s)": (r["Theme(s)"] ?? "").trim(),
          "Thesis Snapshot": (r["Thesis Snapshot"] ?? "").trim(),
          "Key 2026 Catalysts": (r["Key 2026 Catalysts"] ?? "").trim(),
          "What Moves It (Triggers)": (r["What Moves It (Triggers)"] ?? "").trim(),
          "Catalyst Path": (r["Catalyst Path"] ?? "").trim(),
          Notes: (r.Notes ?? "").trim(),
          "Date analyzed": (r["Date analyzed"] ?? "").trim(),
        })) as WatchItem[];
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

  // Distill themes & dates
  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap(r => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );

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

  // --- NEW: fetch closes from Massive (bulk by date) and attach InitialPrice
  const [priceMap, setPriceMap] = useState<Record<string, number>>({}); // key = `${yyyymmdd}|${ticker}`

  async function fetchDayCloses(ymd: string) {
    const r = await fetch(`/api/grouped?date=${encodeURIComponent(ymd)}&adjusted=true&include_otc=false`);
    if (!r.ok) throw new Error(`Massive grouped error ${r.status}`);
    const j = await r.json();
    const out: Record<string, number> = {};
    const results = Array.isArray(j?.results) ? j.results : [];
    for (const row of results) {
      const ticker = row?.T;           // symbol
      const close  = row?.c;           // close
      if (ticker && typeof close === "number") {
        out[`${ymd}|${ticker}`] = close;
      }
    }
    return out;
  }

  // Call the bulk endpoint for every distinct date in your CSV once; cache in priceMap
  useEffect(() => {
    let stop = false;
    (async () => {
      const distinctDates = Array.from(
        new Set(rows.map(r => normalizeToYYYYMMDD(r["Date analyzed"])).filter(Boolean))
      ) as string[];

      const newMap: Record<string, number> = {};
      for (const ymd of distinctDates) {
        try {
          const dayMap = await fetchDayCloses(ymd);
          Object.assign(newMap, dayMap);
        } catch (e) {
          // swallow individual day errors to keep UI responsive
          console.warn("massive grouped error", ymd, e);
        }
        if (stop) return;
      }
      if (!stop) setPriceMap(prev => ({ ...prev, ...newMap }));
    })();
    return () => { stop = true; };
  }, [rows]);

  // Compute enriched rows with InitialPrice populated (if we have it)
  const enrichedRows = useMemo<WatchItem[]>(() => {
    const year = new Date().getFullYear();
    return rows.map(r => {
      const ymd = normalizeToYYYYMMDD(r["Date analyzed"], year);
      const key = ymd ? `${ymd}|${r.Ticker}` : "";
      const InitialPrice = key && priceMap[key] != null ? priceMap[key] : null;
      return { ...r, InitialPrice };
    });
  }, [rows, priceMap]);

  return { rows: enrichedRows, loading, error, allThemes, uniqueDates, themesByDate };
}
