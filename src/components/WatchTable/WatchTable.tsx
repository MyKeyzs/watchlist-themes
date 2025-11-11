// src/components/WatchTable/WatchTable.tsx
import React from "react";
import { WatchItem } from "../../utils/types";
import { MASSIVE_API_KEY } from "../../lib/env";

/* ---------- Sorting ---------- */
export type SortKey =
  | "Ticker"
  | "Company"
  | "Theme(s)"
  | "Date analyzed"
  | "Initial Price"
  | "Current Price"
  | "Total PnL"
  | "Thesis Snapshot"
  | "Key 2026 Catalysts"
  | "What Moves It (Triggers)"
  | "Catalyst Path"
  | "Notes";

export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

type Props = {
  rows: WatchItem[];
  sort: SortState;
  setSort?: (s: SortState) => void;
  onSort?: (s: SortState) => void;
};

/* ---------- Massive helpers ---------- */

const MASSIVE_BASE = "https://api.massive.com";

/** Parse a variety of short “Date analyzed” shapes to YYYY-MM-DD.
 *  Supports:
 *    - M/D or MM/DD (optionally with /YYYY)
 *    - D-MMM or DD-MMM (optionally with -YYYY), e.g. 29-Oct, 4-Oct-2024
 *  Backs up to the previous business day for weekends and future dates.
 */
function normalizeToBizDate(raw: string): string {
  const s = raw.trim();
  const today = new Date();
  let year = today.getFullYear();

  // Map for 3-letter months
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  let d: Date | null = null;

  // 1) Numeric: M/D or MM/DD (with optional /YYYY)
  //    e.g. 10/29 or 10/29/2024
  {
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const yy = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : year;
      d = new Date(Date.UTC(yy, mm - 1, dd));
    }
  }

  // 2) D-MMM or DD-MMM (with optional -YYYY)
  //    e.g. 29-Oct or 4-Oct-2024
  if (!d) {
    const m = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      const dd = Number(m[1]);
      const mon = MONTHS[m[2].toLowerCase()];
      if (mon != null) {
        const yy = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : year;
        d = new Date(Date.UTC(yy, mon, dd));
      }
    }
  }

  // 3) If still not parsed, fallback = two days ago (safe for weekends)
  if (!d) {
    const f = new Date(today);
    f.setUTCDate(f.getUTCDate() - 2);
    return f.toISOString().slice(0, 10);
  }

  // If the parsed date is in the future (e.g., CSV carried forward), nudge back a year
  if (d.getTime() > Date.now()) {
    d.setUTCFullYear(d.getUTCFullYear() - 1);
  }

  // Back up for weekends (Sun=0, Sat=6)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return d.toISOString().slice(0, 10);
}

/** Fetch Massive snapshot (current) price for one ticker. */
async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  const url =
    `${MASSIVE_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/` +
    `${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();

  // Prefer lastTrade.p, then lastQuote.p, then day.c
  const p =
    json?.ticker?.lastTrade?.p ??
    json?.ticker?.lastQuote?.p ??
    json?.ticker?.day?.c ??
    null;

  return typeof p === "number" ? p : null;
}

/** Fetch Massive single-day close for a specific YYYY-MM-DD (Initial Price). */
async function fetchInitialClose(
  ticker: string,
  yyyy_mm_dd: string
): Promise<number | null> {
  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(
      ticker
    )}/range/1/day/${yyyy_mm_dd}/${yyyy_mm_dd}` +
    `?adjusted=true&limit=1&apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const c = json?.results?.[0]?.c ?? null;
  return typeof c === "number" ? c : null;
}

/** Percent PnL */
function pct(initial: number | null, current: number | null): number | null {
  if (initial == null || current == null) return null;
  if (initial === 0) return null;
  return ((current - initial) / initial) * 100;
}

/** Row background color by PnL % */
function rowBgForPct(p: number | null): string | undefined {
  if (p == null) return undefined;
  if (p >= 10) return "#4C763B"; // darker green
  if (p > 0) return "#B0CE88"; // light green
  if (p <= -10) return "#EE4E4E"; // darker red
  if (p < 0) return "#FDAB9E"; // light red
  return undefined;
}

/* ---------- UI bits ---------- */

function Caret({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={
        "ml-1 inline-block text-[10px] transition-opacity " +
        (active ? "opacity-100 text-white" : "opacity-40 text-white")
      }
      aria-hidden
    >
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function TH({
  label,
  sortKey,
  sort,
  applySort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  applySort: (s: SortState) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const onClick = () =>
    applySort({
      key: sortKey,
      dir: active ? (sort.dir === "asc" ? "desc" : "asc") : "asc",
    });

  return (
    <th className={`wl-th ${className ?? ""}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-white">
        <span>{label}</span>
        <Caret active={active} dir={active ? sort.dir : "asc"} />
      </button>
    </th>
  );
}

function Cell({
  value,
  title,
  long,
  className,
}: {
  value: React.ReactNode;
  title?: string;
  long?: boolean;
  className?: string;
}) {
  return (
    <td className={`wl-td ${className ?? ""}`} title={title}>
      <div className={(long ? "wl-td-long" : "wl-td-short") + " sm:whitespace-normal sm:line-clamp-3"}>
        {value ?? "—"}
      </div>
    </td>
  );
}

/* ---------- Main ---------- */

export default function WatchTable({ rows, sort, setSort, onSort }: Props) {
  const applySort = setSort ?? onSort ?? (() => {});

  // caches so we fetch once per ticker/date
  const initCache = React.useRef(new Map<string, number>()); // key: TICKER|YYYY-MM-DD -> close
  const curCache = React.useRef(new Map<string, number>());  // key: TICKER -> snapshot price
  const [tick, setTick] = React.useState(0);                 // nudge rerender on new data

  // Normalize each row’s analyzed date up front
  const normalizedRows = React.useMemo(() => {
    return rows.map((r) => {
      const d = (r["Date analyzed"] || "").trim();
      const biz = d ? normalizeToBizDate(d) : null;
      return { row: r, normDate: biz };
    });
  }, [rows]);

  // Fetch initial close + current price for all unique tickers in the input
  React.useEffect(() => {
    let aborted = false;

    async function run() {
      const tasks: Promise<void>[] = [];

      for (const { row, normDate } of normalizedRows) {
        const tkr = (row.Ticker || "").trim();
        if (!tkr) continue;

        // Initial close (date-specific)
        if (normDate) {
          const initKey = `${tkr}|${normDate}`;
          if (!initCache.current.has(initKey)) {
            tasks.push(
              (async () => {
                const v = await fetchInitialClose(tkr, normDate).catch(() => null);
                if (!aborted && v != null) {
                  initCache.current.set(initKey, v);
                  setTick((x) => x + 1);
                }
              })()
            );
          }
        }

        // Current price (snapshot)
        if (!curCache.current.has(tkr)) {
          tasks.push(
            (async () => {
              const v = await fetchCurrentPrice(tkr).catch(() => null);
              if (!aborted && v != null) {
                curCache.current.set(tkr, v);
                setTick((x) => x + 1);
              }
            })()
          );
        }
      }

      if (tasks.length) await Promise.allSettled(tasks);
    }

    run();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRows.map(n => n.row.Ticker + "|" + (n.normDate ?? "")).join(",")]);

  // Sort
  const sorted = React.useMemo(() => {
    const data = rows.slice();
    const { key, dir } = sort;

    function valueOf(r: WatchItem): string | number {
      if (key === "Initial Price") {
        const d = (r["Date analyzed"] || "").trim();
        const norm = d ? normalizeToBizDate(d) : null;
        const initKey = `${r.Ticker}|${norm}`;
        const v = norm ? initCache.current.get(initKey) : undefined;
        return v ?? Number.NEGATIVE_INFINITY;
      }
      if (key === "Current Price") {
        const v = curCache.current.get(r.Ticker || "");
        return v ?? Number.NEGATIVE_INFINITY;
      }
      if (key === "Total PnL") {
        const d = (r["Date analyzed"] || "").trim();
        const norm = d ? normalizeToBizDate(d) : null;
        const initKey = `${r.Ticker}|${norm}`;
        const init = norm ? initCache.current.get(initKey) : undefined;
        const cur = curCache.current.get(r.Ticker || "");
        if (init == null || cur == null || init === 0) return Number.NEGATIVE_INFINITY;
        return ((cur - init) / init) * 100;
      }
      const s = String((r as any)[key] ?? "").toLowerCase();
      return s;
    }

    data.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, sort, tick]);

  return (
    <div className="wl-table-wrap custom-scroll">
      <table className="wl-table">
        <thead className="wl-thead">
          <tr className="wl-head-row">
            {/* Sticky Ticker */}
            <th className="wl-th sticky left-0 z-30 bg-gray-100/80 backdrop-blur">
              <button
                type="button"
                onClick={() =>
                  applySort({
                    key: "Ticker",
                    dir: sort.key === "Ticker" && sort.dir === "asc" ? "desc" : "asc",
                  })
                }
                className="inline-flex items-center gap-1 text-white"
              >
                <span>Ticker</span>
                <Caret active={sort.key === "Ticker"} dir={sort.dir} />
              </button>
            </th>

            <TH label="Company" sortKey="Company" sort={sort} applySort={applySort} />
            <TH label="Theme(s)" sortKey="Theme(s)" sort={sort} applySort={applySort} />
            <TH label="Date analyzed" sortKey="Date analyzed" sort={sort} applySort={applySort} />

            {/* NEW: Current + PnL + Initial */}
            <TH label="Current Price" sortKey="Current Price" sort={sort} applySort={applySort} />
            <TH label="Total PnL" sortKey="Total PnL" sort={sort} applySort={applySort} />
            <TH label="Initial Price" sortKey="Initial Price" sort={sort} applySort={applySort} />

            <TH label="Thesis" sortKey="Thesis Snapshot" sort={sort} applySort={applySort} />
            <TH label="2026 Catalysts" sortKey="Key 2026 Catalysts" sort={sort} applySort={applySort} />
            <TH label="What Moves It" sortKey="What Moves It (Triggers)" sort={sort} applySort={applySort} />
            <TH label="Catalyst Path" sortKey="Catalyst Path" sort={sort} applySort={applySort} />
            <TH label="Notes" sortKey="Notes" sort={sort} applySort={applySort} />
          </tr>
        </thead>

        <tbody>
          {sorted.map((r, i) => {
            const tkr = (r.Ticker || "").trim();
            const norm = (r["Date analyzed"] || "").trim()
              ? normalizeToBizDate((r["Date analyzed"] || "").trim())
              : null;

            const initKey = norm ? `${tkr}|${norm}` : "";
            const initial = norm ? initCache.current.get(initKey) ?? null : null;
            const current = curCache.current.get(tkr) ?? null;
            const pnlPct = pct(initial, current);

            const bg = rowBgForPct(pnlPct);
            const zebra = i % 2 === 0 ? "wl-row wl-row--even" : "wl-row";
            const style = bg ? { backgroundColor: bg } : undefined;

            return (
              <tr key={`${r.Ticker}-${i}`} className={zebra} style={style}>
                {/* Ticker (sticky) */}
                <td
                  className="wl-ticker-cell"
                  title={r.Ticker}
                  onClick={() =>
                    window.open(
                      `https://www.tradingview.com/chart/WiBJEuAh/?symbol=${encodeURIComponent(r.Ticker)}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <span className="wl-ticker-chip">{r.Ticker || "—"}</span>
                </td>

                <Cell value={r.Company} />
                <Cell value={r["Theme(s)"]} title={r["Theme(s)"]} />
                <Cell value={r["Date analyzed"] || "—"} />

                {/* NEW: Current, PnL, Initial */}
                <Cell value={current != null ? `$${current.toFixed(2)}` : "—"} />
                <Cell value={pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"} />
                <Cell value={initial != null ? `$${initial.toFixed(2)}` : "—"} />

                <Cell value={r["Thesis Snapshot"]} long />
                <Cell value={r["Key 2026 Catalysts"]} long />
                <Cell value={r["What Moves It (Triggers)"]} long />
                <Cell value={r["Catalyst Path"]} long />
                <Cell value={r.Notes} long />
              </tr>
            );
          })}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={12} className="wl-empty">
                No items match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
