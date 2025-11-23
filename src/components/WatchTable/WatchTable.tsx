// src/components/WatchTable/WatchTable.tsx
import React from "react";

import PopoutModal from "../../components/PopoutModal/PopoutModal";
import { MASSIVE_API_KEY } from "../../lib/env";
import { WatchItem, SortKey, SortState, SortDir } from "../../utils/types";

// re-export for WatchlistPage
export type { SortState } from "../../utils/types";
type Props = {
  rows: WatchItem[];
  sort: SortState;
  setSort?: (s: SortState) => void;
  onSort?: (s: SortState) => void;
};

/* ---------- Massive helpers ---------- */

const MASSIVE_BASE = "https://api.massive.com";

/** Parse a variety of short “Date analyzed” shapes to YYYY-MM-DD. */
function normalizeToBizDate(raw: string): string {
  const s = (raw || "").trim();
  const today = new Date();
  let year = today.getFullYear();

  const MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  let d: Date | null = null;

  // M/D or MM/DD (/YYYY optional)
  {
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const yy = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : year;
      d = new Date(Date.UTC(yy, mm - 1, dd));
    }
  }

  // D-MMM (/-YYYY optional)
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

  // Fallback = two days ago
  if (!d) {
    const f = new Date(today);
    f.setUTCDate(f.getUTCDate() - 2);
    return f.toISOString().slice(0, 10);
  }

  // Guard future
  if (d.getTime() > Date.now()) d.setUTCFullYear(d.getUTCFullYear() - 1);

  // Back up for weekends
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return d.toISOString().slice(0, 10);
}

/** Business-day helpers (UTC) */
function prevBizDate(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d;
}
function nBizDaysAgo(date: Date, n: number): Date {
  let d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  let count = 0;
  while (count < n) {
    d = prevBizDate(d);
    count++;
  }
  return d;
}
function ytdAnchor(date: Date): Date {
  // First trading day of this year (approx: Jan 1 then roll forward to weekday)
  const d = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  // If Jan 1 is weekend, roll forward to Monday
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Massive: snapshot (current) */
async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  const url =
    `${MASSIVE_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/` +
    `${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(
      MASSIVE_API_KEY
    )}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const p =
    json?.ticker?.lastTrade?.p ??
    json?.ticker?.lastQuote?.p ??
    json?.ticker?.day?.c ??
    null;
  return typeof p === "number" ? p : null;
}

/** Massive: single-day close for YYYY-MM-DD */
async function fetchClose(
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

/** Percent change helper */
function pct(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/* ---------- PnL → CSS class (glow rows) ---------- */
function rowClassForPct(p: number | null): string {
  if (p == null) return "";
  if (p >= 10) return "wl-row-pnl-strong-pos";
  if (p > 0) return "wl-row-pnl-pos";
  if (p <= -10) return "wl-row-pnl-strong-neg";
  if (p < 0) return "wl-row-pnl-neg";
  return "";
}

/* ---------- Tolerant field accessors ---------- */

const firstValue = (obj: any, keys: string[]): string => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
};

const FIELDS = {
  thesis: ["Thesis Snapshot", "Thesis", "Thesis snapshot", "Thesis_Snapshot"],
  catalysts2026: [
    "Key 2026 Catalysts",
    "2026 Catalysts",
    "2026 catalysts",
    "Catalysts",
    "Key Catalysts 2026",
  ],
  whatMovesIt: [
    "What Moves It (Triggers)",
    "What Moves It",
    "What moves it",
    "Triggers",
    "What_Moves_It",
  ],
  themes: ["Theme(s)", "Themes", "Theme", "Theme_1", "Theme_2"],
  dateAnalyzed: [
    "Date analyzed",
    "Date Analyzed",
    "Date_Analyzed",
    "Analyzed Date",
  ],
};

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
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-white"
      >
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
      <div
        className={
          (long ? "wl-td-long" : "wl-td-short") +
          " sm:whitespace-normal sm:line-clamp-3"
        }
      >
        {value ?? "—"}
      </div>
    </td>
  );
}

/* ---------- Small helper: run tasks in batches to avoid hammering API ---------- */

async function runInBatches(
  fns: Array<() => Promise<void>>,
  batchSize = 8
): Promise<void> {
  for (let i = 0; i < fns.length; i += batchSize) {
    const slice = fns.slice(i, i + batchSize).map((fn) => fn());
    await Promise.allSettled(slice);
  }
}

/* ---------- Main ---------- */

export default function WatchTable({ rows, sort, setSort, onSort }: Props) {
  const applySort = setSort ?? onSort ?? (() => {});

  // popout modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalTicker, setModalTicker] = React.useState<string>("");
  const [modalThesis, setModalThesis] = React.useState<string>("");
  const [modalCatalysts, setModalCatalysts] = React.useState<string>("");
  const [modalWhatMoves, setModalWhatMoves] = React.useState<string>("");

  const openModalFor = (row: WatchItem) => {
    const t = (row.Ticker || "").trim();
    if (!t) return;
    setModalTicker(t);
    setModalThesis(firstValue(row as any, FIELDS.thesis));
    setModalCatalysts(firstValue(row as any, FIELDS.catalysts2026));
    setModalWhatMoves(firstValue(row as any, FIELDS.whatMovesIt));
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  // caches so we fetch once per ticker/date
  const initCache = React.useRef(new Map<string, number>()); // key: TICKER|YYYY-MM-DD -> close
  const curCache = React.useRef(new Map<string, number>()); // key: TICKER -> snapshot price
  const closeCache = React.useRef(new Map<string, number>()); // key: TICKER|YYYY-MM-DD -> close (for perf windows)
  const [tick, setTick] = React.useState(0); // nudge rerender on new data

  // Normalize each row’s analyzed date up front
  const normalizedRows = React.useMemo(() => {
    return rows.map((r) => {
      const analyzed = firstValue(r as any, FIELDS.dateAnalyzed);
      const biz = analyzed ? normalizeToBizDate(analyzed) : null;
      return { row: r, normDate: biz };
    });
  }, [rows]);

  // Precompute benchmark dates
  const today = new Date();
  const d1 = prevBizDate(today); // yesterday's biz day
  const d5 = nBizDaysAgo(today, 5); // ~ one trading week ago
  const dYTD = ytdAnchor(today); // first trading day of year

  const d1Str = fmt(d1);
  const d5Str = fmt(d5);
  const dYTDStr = fmt(dYTD);

  // Fetch initial close + current price + perf-window closes
  React.useEffect(() => {
    let aborted = false;

    async function run() {
      const taskFns: Array<() => Promise<void>> = [];

      for (const { row, normDate } of normalizedRows) {
        const tkr = (row.Ticker || "").trim();
        if (!tkr) continue;

        // Initial close (for Total PnL vs Date analyzed)
        if (normDate) {
          const initKey = `${tkr}|${normDate}`;
          if (!initCache.current.has(initKey)) {
            taskFns.push(async () => {
              const v = await fetchClose(tkr, normDate).catch(() => null);
              if (!aborted && v != null) {
                initCache.current.set(initKey, v);
                setTick((x) => x + 1);
              }
            });
          }
        }

        // Current price (snapshot)
        if (!curCache.current.has(tkr)) {
          taskFns.push(async () => {
            const v = await fetchCurrentPrice(tkr).catch(() => null);
            if (!aborted && v != null) {
              curCache.current.set(tkr, v);
              setTick((x) => x + 1);
            }
          });
        }

        // Perf window closes (1D, 1W, YTD)
        for (const ds of [d1Str, d5Str, dYTDStr]) {
          const key = `${tkr}|${ds}`;
          if (!closeCache.current.has(key)) {
            taskFns.push(async () => {
              const v = await fetchClose(tkr, ds).catch(() => null);
              if (!aborted && v != null) {
                closeCache.current.set(key, v);
                setTick((x) => x + 1);
              }
            });
          }
        }
      }

      if (taskFns.length) {
        // Process in small batches instead of hammering the API
        await runInBatches(taskFns, 6); // tweak 6 → 4/8/etc if you want
      }
    }

    run();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalizedRows.map((n) => n.row.Ticker + "|" + (n.normDate ?? "")).join(","),
    d1Str,
    d5Str,
    dYTDStr,
  ]);

  // Sort
  const sorted = React.useMemo(() => {
    const data = rows.slice();
    const { key, dir } = sort;

    const numericOrNegInf = (v: number | null | undefined) =>
      typeof v === "number" ? v : Number.NEGATIVE_INFINITY;

    const valueOf = (r: WatchItem): string | number => {
      const tkr = (r.Ticker || "").trim();

      if (key === "Initial Price") {
        const analyzed = firstValue(r as any, FIELDS.dateAnalyzed);
        const norm = analyzed ? normalizeToBizDate(analyzed) : null;
        const initKey = `${tkr}|${norm}`;
        const v = norm ? initCache.current.get(initKey) : undefined;
        return numericOrNegInf(v);
      }
      if (key === "Current Price") {
        const v = curCache.current.get(tkr);
        return numericOrNegInf(v);
      }
      if (key === "Total PnL") {
        const analyzed = firstValue(r as any, FIELDS.dateAnalyzed);
        const norm = analyzed ? normalizeToBizDate(analyzed) : null;
        const initKey = `${tkr}|${norm}`;
        const init = norm ? initCache.current.get(initKey) : undefined;
        const cur = curCache.current.get(tkr);
        if (init == null || cur == null || init === 0)
          return Number.NEGATIVE_INFINITY;
        return ((cur - init) / init) * 100;
      }
      if (key === "1Day Change (%)") {
        const base = closeCache.current.get(`${tkr}|${d1Str}`);
        const cur = curCache.current.get(tkr);
        return numericOrNegInf(pct(base ?? null, cur ?? null) ?? null);
      }
      if (key === "1Week Change (%)") {
        const base = closeCache.current.get(`${tkr}|${d5Str}`);
        const cur = curCache.current.get(tkr);
        return numericOrNegInf(pct(base ?? null, cur ?? null) ?? null);
      }
      if (key === "YTD Change (%)") {
        const base = closeCache.current.get(`${tkr}|${dYTDStr}`);
        const cur = curCache.current.get(tkr);
        return numericOrNegInf(pct(base ?? null, cur ?? null) ?? null);
      }

      // default: text
      return String((r as any)[key] ?? "").toLowerCase();
    };

    data.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, sort, tick, d1Str, d5Str, dYTDStr]);

  return (
    <>
      <div className="wl-table-wrap custom-scroll">
        <table className="wl-table">
          <thead className="wl-thead">
            <tr className="wl-head-row">
              {/* Sticky Ticker */}
              <th className="wl-th sticky left-0 z-30 backdrop-blur">
                <button
                  type="button"
                  onClick={() =>
                    applySort({
                      key: "Ticker",
                      dir:
                        sort.key === "Ticker" && sort.dir === "asc"
                          ? "desc"
                          : "asc",
                    })
                  }
                  className="inline-flex items-center gap-1 text-white"
                >
                  <span>Ticker</span>
                  <Caret active={sort.key === "Ticker"} dir={sort.dir} />
                </button>
              </th>

              <TH
                label="Company"
                sortKey="Company"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Theme(s)"
                sortKey="Theme(s)"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Date analyzed"
                sortKey="Date analyzed"
                sort={sort}
                applySort={applySort}
              />

              {/* Prices & PnL */}
              <TH
                label="Initial Price"
                sortKey="Initial Price"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Current Price"
                sortKey="Current Price"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Total PnL"
                sortKey="Total PnL"
                sort={sort}
                applySort={applySort}
              />

              {/* Perf windows */}
              <TH
                label="1Day Change (%)"
                sortKey="1Day Change (%)"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="1Week Change (%)"
                sortKey="1Week Change (%)"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="YTD Change (%)"
                sortKey="YTD Change (%)"
                sort={sort}
                applySort={applySort}
              />
            </tr>
          </thead>

          <tbody>
            {sorted.map((r, i) => {
              const tkr = (r.Ticker || "").trim();
              const analyzed = firstValue(r as any, FIELDS.dateAnalyzed);
              const norm = analyzed ? normalizeToBizDate(analyzed) : null;

              const initKey = norm ? `${tkr}|${norm}` : "";
              const initial = norm ? initCache.current.get(initKey) ?? null : null;
              const current = curCache.current.get(tkr) ?? null;
              const pnlPct = pct(initial, current);

              const d1Close =
                closeCache.current.get(`${tkr}|${d1Str}`) ?? null;
              const d5Close =
                closeCache.current.get(`${tkr}|${d5Str}`) ?? null;
              const dYClose =
                closeCache.current.get(`${tkr}|${dYTDStr}`) ?? null;

              const ch1d = pct(d1Close, current);
              const ch1w = pct(d5Close, current);
              const chYTD = pct(dYClose, current);

              const themes = firstValue(r as any, FIELDS.themes);
              const zebra = i % 2 === 0 ? "wl-row wl-row--even" : "wl-row";
              const glowClass = rowClassForPct(pnlPct);

              return (
                <tr
                  key={`${r.Ticker}-${i}`}
                  className={`${zebra} wl-row-clickable ${glowClass}`}
                  onClick={() => openModalFor(r)}
                >
                  {/* Ticker (sticky) */}
                  <td
                    className="wl-ticker-cell"
                    title={r.Ticker}
                    style={{ cursor: "pointer", background: "inherit" }}
                  >
                    <span className="wl-ticker-chip">
                      {r.Ticker || "—"}
                    </span>
                  </td>

                  <Cell value={r.Company} />
                  <Cell value={themes} title={themes} />
                  <Cell value={analyzed || "—"} />

                  <Cell
                    value={
                      initial != null ? `$${initial.toFixed(2)}` : "—"
                    }
                  />
                  <Cell
                    value={
                      current != null ? `$${current.toFixed(2)}` : "—"
                    }
                  />
                  <Cell
                    value={
                      pnlPct != null
                        ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`
                        : "—"
                    }
                  />

                  <Cell
                    value={
                      ch1d != null
                        ? `${ch1d >= 0 ? "+" : ""}${ch1d.toFixed(2)}%`
                        : "—"
                    }
                  />
                  <Cell
                    value={
                      ch1w != null
                        ? `${ch1w >= 0 ? "+" : ""}${ch1w.toFixed(2)}%`
                        : "—"
                    }
                  />
                  <Cell
                    value={
                      chYTD != null
                        ? `${chYTD >= 0 ? "+" : ""}${chYTD.toFixed(2)}%`
                        : "—"
                    }
                  />
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                {/* Ticker + (Company, Theme, Date, 3 price cols, 3 perf cols) = 10 total */}
                <td colSpan={10} className="wl-empty">
                  No items match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal outside table */}
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
