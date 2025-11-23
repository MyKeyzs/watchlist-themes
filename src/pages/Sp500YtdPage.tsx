// src/pages/Sp500YtdPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { MASSIVE_API_KEY } from "../lib/env";
import sp500Html from "../data/sANDp500.txt?raw";
import PopoutModal from "../components/PopoutModal/PopoutModal";

/* ---------- Types ---------- */

type Sp500Entry = {
  symbol: string;
  company: string;
};

type Metrics = {
  current: number | null; // latest close
  ytdPct: number | null; // (close - open) / open * 100
};

/* ---------- Parse the sANDp500.txt file once ---------- */

function parseSp500(html: string): Sp500Entry[] {
  const rows: Sp500Entry[] = [];
  // matches rows like: <td>1</td><td><a...>Western Digital</a></td><td><a...>WDC</a></td>
  const rowRegex =
    /<tr>\s*<td>\d+<\/td>\s*<td><a href="\/symbol\/[^"]+">([^<]+)<\/a><\/td>\s*<td><a href="\/symbol\/([^"]+)">[^<]+<\/a><\/td>/g;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const company = match[1].trim();
    const symbol = match[2].trim();
    if (symbol) rows.push({ symbol, company });
  }
  return rows;
}

const SP500_LIST: Sp500Entry[] = parseSp500(sp500Html);

/* ---------- Ticker drift / corporate action normalization ---------- */
/**
 * These rules fix symbol drift and rebrands so:
 *  1) The S&P list is "current" for the snapshot date (toStr)
 *  2) Historical open/close fetches use the ticker that was valid on that date
 *
 * Your known edge cases:
 *  - PSKY used to be PARA (change ~2025-08-07)
 *  - Q joined S&P on 2025-11-03 (membership gate)
 *  - XYZ used to be SQ (change 2025-01-21)
 *  - FISV <-> FI round trip:
 *        FISV → FI (2023-06-06)
 *        FI → FISV again (2025-11-11)
 */

// Simple date helpers for comparisons (UTC, day-granularity)
const toDateMs = (yyyy_mm_dd: string) =>
  new Date(yyyy_mm_dd + "T00:00:00Z").getTime();

const inRange = (dMs: number, from: string, to?: string) => {
  const f = toDateMs(from);
  const t = to ? toDateMs(to) : Infinity;
  return dMs >= f && dMs <= t;
};

/**
 * Returns the ticker that was actually tradable on `yyyy_mm_dd`.
 * Works whether you pass the old or new symbol in.
 */
function tickerAtDate(rawTicker: string, yyyy_mm_dd: string): string {
  const t = rawTicker.toUpperCase().trim();
  const d = toDateMs(yyyy_mm_dd);

  // PARA ↔ PSKY
  if (t === "PARA" && d >= toDateMs("2025-08-07")) return "PSKY";
  if (t === "PSKY" && d < toDateMs("2025-08-07")) return "PARA";

  // SQ ↔ XYZ
  if (t === "SQ" && d >= toDateMs("2025-01-21")) return "XYZ";
  if (t === "XYZ" && d < toDateMs("2025-01-21")) return "SQ";

  // Fiserv round trip
  if (t === "FI" && d >= toDateMs("2025-11-11")) return "FISV";
  if (t === "FISV" && inRange(d, "2023-06-06", "2025-11-10")) return "FI";

  return t;
}

/* ---------- S&P membership-by-date ledger ---------- */
/**
 * Only needed for cases where membership changes mid-year.
 * You mentioned:
 *  - Q joined 2025-11-03
 */
type SpMembershipEvent = {
  ticker: string;
  joined: string; // YYYY-MM-DD inclusive
  left?: string; // YYYY-MM-DD inclusive (if removed)
};

const SP500_MEMBERSHIP_EVENTS: SpMembershipEvent[] = [
  { ticker: "Q", joined: "2025-11-03" },
];

function isMemberOnDate(ticker: string, yyyy_mm_dd: string): boolean {
  const t = ticker.toUpperCase();
  const d = toDateMs(yyyy_mm_dd);

  const evt = SP500_MEMBERSHIP_EVENTS.find(
    (e) => e.ticker.toUpperCase() === t
  );
  if (!evt) return true; // default: assume member unless ledger says otherwise

  const joinedMs = toDateMs(evt.joined);
  const leftMs = evt.left ? toDateMs(evt.left) : Infinity;
  return d >= joinedMs && d <= leftMs;
}

/* ---------- IPO / spin-off baseline overrides ---------- */
/**
 * If a company starts trading AFTER Jan 1 of the snapshot year,
 * your `fromStr` open-close will be null.
 *
 * Provide a baseline date for those tickers so YTD is computed
 * from their first trading day instead of Jan 2.
 *
 * Q started regular-way trading on 2025-11-03. :contentReference[oaicite:1]{index=1}
 */
const YTD_BASELINE_OVERRIDE: Record<string, string> = {
  Q: "2025-11-03",
};

/* ---------- Massive: /v1/open-close helper ---------- */

const MASSIVE_BASE = "https://api.massive.com";

type DailyOC = { open: number | null; close: number | null };

/**
 * Call Massive /v1/open-close/{ticker}/{date} and return open & close.
 */
async function fetchDailyOpenClose(
  ticker: string,
  yyyy_mm_dd: string
): Promise<DailyOC> {
  const url =
    `${MASSIVE_BASE}/v1/open-close/${encodeURIComponent(
      ticker
    )}/${yyyy_mm_dd}` + `?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) {
    return { open: null, close: null };
  }
  const json = await res.json();

  // Be tolerant of different shapes: open/close vs o/c
  const openRaw = (json as any).open ?? (json as any).o;
  const closeRaw = (json as any).close ?? (json as any).c;

  const open = typeof openRaw === "number" ? openRaw : null;
  const close = typeof closeRaw === "number" ? closeRaw : null;

  return { open, close };
}

/**
 * Use two /v1/open-close calls:
 *  - first trading day of the year (open)
 *  - most recent trading day (close)
 * Compute YTD from those.
 *
 * IMPORTANT:
 *  - We resolve ticker drift per-date so historical fetches
 *    use old tickers when needed.
 *  - If open is null because the stock didn’t trade yet this year,
 *    we fall back to a baseline override (e.g., Q).
 *
 * SOLS: force open = 48.40
 */
async function fetchYtdMetrics(
  canonicalTicker: string,
  from: string,
  to: string
): Promise<Metrics> {
  const canonicalUpper = canonicalTicker.toUpperCase();

  // Resolve which ticker was valid on each date
  const startTicker = tickerAtDate(canonicalUpper, from);
  const endTicker = tickerAtDate(canonicalUpper, to);

  const [start, end] = await Promise.all([
    fetchDailyOpenClose(startTicker, from),
    fetchDailyOpenClose(endTicker, to),
  ]);

  let open = start.open;
  const close = end.close;

  // 🔹 Special-case SOLS: force open to 48.40
  if (canonicalUpper === "SOLS") {
    open = 48.4;
  }

  // 🔹 NEW: If no open because not trading on fromStr, try baseline override.
  if (open == null) {
    const overrideDate = YTD_BASELINE_OVERRIDE[canonicalUpper];
    if (overrideDate) {
      const overrideTicker = tickerAtDate(canonicalUpper, overrideDate);
      const overrideOC = await fetchDailyOpenClose(
        overrideTicker,
        overrideDate
      );
      if (overrideOC.open != null) {
        open = overrideOC.open;
      }
    }
  }

  if (open == null || close == null || open === 0) {
    return { current: close, ytdPct: null };
  }

  const ytdPct = ((close - open) / open) * 100;
  return { current: close, ytdPct };
}

/* ---------- Date helpers ---------- */

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function firstBizDayOfYear(year: number): Date {
  const d = new Date(Date.UTC(year, 0, 2));
  // roll forward to Monday if Jan 1 is weekend
  while (isWeekend(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function lastBizDayOnOrBefore(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  while (isWeekend(d)) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

const MAX_CONCURRENT = 8; // throttle workers

/* ---------- Main component ---------- */

export default function Sp500YtdPage() {
  const [metrics, setMetrics] = useState<Record<string, Metrics>>({});
  const [loadedCount, setLoadedCount] = useState(0);

  // popout modal state (mirrors WatchTable pattern)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState<string>("");
  const [modalThesis, setModalThesis] = useState<string>("");
  const [modalCatalysts, setModalCatalysts] = useState<string>("");
  const [modalWhatMoves, setModalWhatMoves] = useState<string>("");

  const openModalForSymbol = (symbol: string) => {
    setModalTicker(symbol);
    // No thesis/catalysts/what-moves-it data for S&P list yet, so leave them empty
    setModalThesis("");
    setModalCatalysts("");
    setModalWhatMoves("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const today = useMemo(() => new Date(), []);
  const year = today.getUTCFullYear();

  const fromDate = firstBizDayOfYear(year);
  const toDate = lastBizDayOnOrBefore(today);

  const fromStr = fmtDate(fromDate);
  const toStr = fmtDate(toDate);

  /**
   * Build the "active" S&P list for the snapshot date (toStr):
   * 1) Map any old tickers to their current symbols for toStr
   * 2) Apply membership ledger (e.g., Q only after 2025-11-03)
   * 3) De-dupe in case the source list already has the new symbol
   */
  const ACTIVE_SP500_LIST = useMemo(() => {
    const snapshotDate = toStr;

    const mapped = SP500_LIST
      .map((e) => {
        const canonicalSymbol = tickerAtDate(e.symbol, snapshotDate);
        return { ...e, symbol: canonicalSymbol };
      })
      .filter((e) => isMemberOnDate(e.symbol, snapshotDate));

    // De-dupe by symbol (in case PARA and PSKY both appear, etc.)
    const seen = new Set<string>();
    const deduped: Sp500Entry[] = [];
    for (const e of mapped) {
      if (seen.has(e.symbol)) continue;
      seen.add(e.symbol);
      deduped.push(e);
    }
    return deduped;
  }, [toStr]);

  // Throttled loader: don't hammer Massive with 500 * 2 calls at once.
  useEffect(() => {
    let cancelled = false;

    setMetrics({});
    setLoadedCount(0);

    async function run() {
      let index = 0;
      const total = ACTIVE_SP500_LIST.length;

      async function worker() {
        while (true) {
          if (cancelled) return;
          const myIndex = index;
          if (myIndex >= total) return;
          index++;

          const { symbol } = ACTIVE_SP500_LIST[myIndex];

          try {
            const m = await fetchYtdMetrics(symbol, fromStr, toStr);
            if (cancelled) return;

            setMetrics((prev) => ({
              ...prev,
              [symbol]: m,
            }));
            setLoadedCount((c) => c + 1);
          } catch {
            // ignore per-ticker errors
          }
        }
      }

      const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
      await Promise.all(workers);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [fromStr, toStr, ACTIVE_SP500_LIST]);

  // Build sorted rows with computed YTD %
  const rows = useMemo(() => {
    return ACTIVE_SP500_LIST.map((entry) => {
      const m = metrics[entry.symbol];
      const current = m?.current ?? null;
      const ytdPct = m?.ytdPct ?? null;

      return {
        ...entry,
        current,
        ytdPct,
      };
    }).sort((a, b) => {
      if (a.ytdPct == null && b.ytdPct == null) return 0;
      if (a.ytdPct == null) return 1;
      if (b.ytdPct == null) return -1;
      return b.ytdPct - a.ytdPct;
    });
  }, [metrics, ACTIVE_SP500_LIST]);

  return (
    <>
      <div className="wl-page">
        <header className="wl-page-header">
          <h1 className="wl-title">S&amp;P 500 Components – YTD Returns</h1>
          <p className="wl-subtitle">
            YTD based on Massive <code>/v1/open-close</code> from {fromStr} to{" "}
            {toStr}.
          </p>
          <p className="wl-subtitle">
            Loaded {loadedCount} / {ACTIVE_SP500_LIST.length} tickers…
          </p>
        </header>

        <div className="wl-table-wrap custom-scroll">
          <table className="wl-table">
            <thead className="wl-thead">
              <tr className="wl-head-row">
                <th className="wl-th">Rank</th>
                <th className="wl-th">Company</th>
                <th className="wl-th">Symbol</th>
                <th className="wl-th">Current (close)</th>
                <th className="wl-th">YTD Return (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const ytd = r.ytdPct;
                const isPos = ytd != null && ytd >= 0;
                const isNeg = ytd != null && ytd < 0;

                const rowClass =
                  "wl-row " + (idx % 2 === 0 ? "wl-row--even" : "");

                return (
                  <tr key={r.symbol} className={rowClass}>
                    <td className="wl-td">{idx + 1}</td>
                    <td className="wl-td">{r.company}</td>
                    <td className="wl-td">
                      <span
                        className="wl-ticker-chip"
                        onClick={() => openModalForSymbol(r.symbol)}
                      >
                        {r.symbol}
                      </span>
                    </td>
                    <td className="wl-td">
                      {r.current != null ? `$${r.current.toFixed(2)}` : "—"}
                    </td>
                    <td className="wl-td">
                      {ytd == null ? (
                        "—"
                      ) : (
                        <span
                          style={{
                            color: isPos
                              ? "#32e676"
                              : isNeg
                              ? "#ff5c5c"
                              : "inherit",
                            fontWeight: 600,
                          }}
                        >
                          {ytd >= 0 ? "+" : ""}
                          {ytd.toFixed(2)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="wl-empty">
                    Loading S&amp;P 500 components…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Same PopoutModal pattern as WatchTable */}
      <PopoutModal
        ticker={modalTicker}
        open={modalOpen}
        onClose={closeModal}
        thesis={modalThesis}
        catalysts2026={modalCatalysts}
        whatMovesIt={modalWhatMoves}
      />
    </>
  );
}
