// Lightweight Massive client for prices + cache
// Close for a specific date uses: /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}
// Current price tries a few “last trade/quote” style endpoints.
// API key read from Vite env: VITE_MASSIVE_API_KEY

type AggsResponse = { results?: Array<{ c: number }>; status?: string; next_url?: string };

const priceCache = new Map<string, number>();     // (ticker|date) -> initial
const currentCache = new Map<string, number>();   // ticker -> current

export function normalizeToYYYYMMDD(d: string): string | null {
  const s = (d || "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const md = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (md) {
    const year = new Date().getFullYear();
    const mm = String(Number(md[1])).padStart(2, "0");
    const dd = String(Number(md[2])).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  const mon = s.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i);
  if (mon) {
    const y = new Date().getFullYear();
    const mMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = mMap[mon[2].toLowerCase()];
    const dd = String(Number(mon[1])).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function getEnvApiKey(): string {
  const key = (import.meta as any).env?.VITE_MASSIVE_API_KEY || "";
  return key;
}

const MASSIVE_BASE = "https://api.massive.com";

export async function getCloseForTickerOnDate(ticker: string, dateAnalyzed: string): Promise<number | null> {
  const date = normalizeToYYYYMMDD(dateAnalyzed);
  if (!ticker || !date) return null;

  const cacheKey = `${ticker}|${date}`;
  if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!;

  const apiKey = getEnvApiKey();
  let url = `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${date}/${date}?adjusted=true&limit=1`;
  let headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let res = await fetch(url, { headers });
  if (res.status === 401 && apiKey) {
    url += `&apiKey=${apiKey}`;
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`Massive ${res.status}`);

  const json = (await res.json()) as AggsResponse;
  const close = json?.results?.[0]?.c ?? null;
  if (close != null) priceCache.set(cacheKey, close);
  return close;
}

/** Try common “last” endpoints to get a current/last trade price. Caches per ticker. */
export async function getCurrentPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;
  if (currentCache.has(ticker)) return currentCache.get(ticker)!;

  const apiKey = getEnvApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // Candidates (Massive’s docs mirror Polygon-style paths):
  const candidates = [
    `${MASSIVE_BASE}/v2/last/trade/${encodeURIComponent(ticker)}`,
    `${MASSIVE_BASE}/v2/trades/${encodeURIComponent(ticker)}/last`,
    `${MASSIVE_BASE}/v2/last/stock/${encodeURIComponent(ticker)}`,
  ];

  let price: number | null = null;
  for (const base of candidates) {
    let url = base;
    let res = await fetch(url, { headers });
    if (res.status === 401 && apiKey) {
      url = url.includes("?") ? `${url}&apiKey=${apiKey}` : `${url}?apiKey=${apiKey}`;
      res = await fetch(url);
    }
    if (!res.ok) continue;

    // Be liberal in what we accept
    const j: any = await res.json();
    price =
      j?.price ??
      j?.p ??
      j?.last?.price ??
      j?.results?.price ??
      j?.results?.p ??
      null;

    if (typeof price === "number" && isFinite(price)) break;
  }

  if (price != null) currentCache.set(ticker, price);
  return price;
}
