// src/utils/prices.ts
type PricePair = { initial: number | null; current: number | null };

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseAnalyzedDate(input: string | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();

  // 1) 29-Oct or 4-Oct or 29-Oct-2025
  let m = s.match(/^(\d{1,2})[-/](\w{3})[-/]?(\d{2,4})?$/i);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2].toLowerCase()];
    let year = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (Number.isFinite(day) && mon >= 0 && Number.isFinite(year)) {
      return new Date(Date.UTC(year, mon, day));
    }
  }

  // 2) 10/04 or 10-04 => assume current year (MM/DD)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const mm = Number(m[1]) - 1;
    const dd = Number(m[2]);
    const yy = new Date().getFullYear();
    return new Date(Date.UTC(yy, mm, dd));
  }

  // 3) ISO (fallback)
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function yyyymmddUTC(d: Date): string {
  const yy = d.getUTCFullYear();
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getUTCDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** in-memory cache so we don’t refetch the same key repeatedly */
const _cache = new Map<string, number | null>();

async function getMassiveClose(ticker: string, dateISO: string): Promise<number | null> {
  const key = `close:${ticker}:${dateISO}`;
  if (_cache.has(key)) return _cache.get(key) ?? null;

  const apiKey = import.meta.env.VITE_MASSIVE_API_KEY || "";
  if (!apiKey) {
    console.warn("Missing VITE_MASSIVE_API_KEY; returning null price.");
    _cache.set(key, null);
    return null;
  }

  // Custom Bars (OHLC): /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}
  const url = new URL(`https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${dateISO}/${dateISO}`);
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    const close = Array.isArray(json?.results) && json.results[0]?.c;
    const val = typeof close === "number" ? close : null;
    _cache.set(key, val);
    return val;
  } catch (e) {
    console.error("Massive close fetch failed", { ticker, dateISO, e });
    _cache.set(key, null);
    return null;
  }
}

async function getMassiveLatest(ticker: string): Promise<number | null> {
  const key = `latest:${ticker}`;
  if (_cache.has(key)) return _cache.get(key) ?? null;

  const apiKey = import.meta.env.VITE_MASSIVE_API_KEY || "";
  if (!apiKey) {
    console.warn("Missing VITE_MASSIVE_API_KEY; returning null price.");
    _cache.set(key, null);
    return null;
  }

  // Latest trade is the simplest way to approximate "current"
  const url = new URL(`https://api.massive.com/v2/last/trade/${encodeURIComponent(ticker)}`);
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    const price = json?.results?.p;
    const val = typeof price === "number" ? price : null;
    _cache.set(key, val);
    return val;
  } catch (e) {
    console.error("Massive latest fetch failed", { ticker, e });
    _cache.set(key, null);
    return null;
  }
}

/** Public helper used by the table */
export async function getPricesForRow(ticker: string, analyzedRaw: string | undefined): Promise<PricePair> {
  const d = parseAnalyzedDate(analyzedRaw);
  const initial = d ? await getMassiveClose(ticker, yyyymmddUTC(d)) : null;
  const current = await getMassiveLatest(ticker);
  return { initial, current };
}

/** safe PnL % */
export function calcPnlPct(initial: number | null, current: number | null): number | null {
  if (initial == null || current == null || initial === 0) return null;
  return ((current - initial) / initial) * 100;
}

/** row background by PnL % */
export function pnlToRowBg(pct: number | null): string | undefined {
  if (pct == null) return undefined;
  if (pct >= 10) return "#4C763B";     // dark green
  if (pct > 0)  return "#B0CE88";     // light green
  if (pct <= -10) return "#EE4E4E";   // dark red
  if (pct < 0)   return "#FDAB9E";    // light red
  return undefined;
}
