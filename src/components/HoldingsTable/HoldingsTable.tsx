// src/components/HoldingsTable/HoldingsTable.tsx
import React from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MASSIVE_API_KEY } from "../../lib/env";
import HoldingsPopout, {
  HoldingsFormValues,
} from "../HoldingsPopout/HoldingsPopout";

/* ---------- Types ---------- */

type HoldingDoc = {
  id: string;
  ticker: string;
  sector?: string;
  subSector?: string;
  quantity: number;
  avgCost: number;
};

type EnrichedHolding = HoldingDoc & {
  lastPrice: number | null;
  mktValue: number | null;
  totalReturnPct: number | null;
  todayReturnPct: number | null;
  weekReturnPct: number | null;
};

type SortKey =
  | "Ticker"
  | "Sector"
  | "Sub-Sector"
  | "Quantity"
  | "Last Price"
  | "Avg Cost"
  | "Mkt Value"
  | "Total Return (%)"
  | "Today's Return (%)"
  | "Weekly Return (%)";

type SortDir = "asc" | "desc";

type SortState = {
  key: SortKey;
  dir: SortDir;
};

type Props = {
  uid: string;
};

/* ---------- Massive helpers (similar to WatchTable) ---------- */

const MASSIVE_BASE = "https://api.massive.com";

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  const url =
    `${MASSIVE_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/` +
    `${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(
      MASSIVE_API_KEY
    )}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const p =
      json?.ticker?.lastTrade?.p ??
      json?.ticker?.lastQuote?.p ??
      json?.ticker?.day?.c ??
      null;
    return typeof p === "number" ? p : null;
  } catch {
    return null;
  }
}

async function fetchClose(
  ticker: string,
  yyyy_mm_dd: string
): Promise<number | null> {
  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(
      ticker
    )}/range/1/day/${yyyy_mm_dd}/${yyyy_mm_dd}` +
    `?adjusted=true&limit=1&apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const c = json?.results?.[0]?.c ?? null;
    return typeof c === "number" ? c : null;
  } catch {
    return null;
  }
}

function pct(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/* ---------- Business day helpers (UTC) ---------- */

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

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ---------- Small helpers (UI formatting) ---------- */

function formatCurrency(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

function formatPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

function pctClass(p: number | null): string {
  if (p == null) return "";
  if (p >= 10) return "wl-cell-pnl-strong-pos";
  if (p > 0) return "wl-cell-pnl-pos";
  if (p <= -10) return "wl-cell-pnl-strong-neg";
  if (p < 0) return "wl-cell-pnl-neg";
  return "";
}

/* ---------- Sort header bits (copied style from WatchTable) ---------- */

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

/* ---------- Run async tasks in small batches ---------- */

async function runInBatches(
  fns: Array<() => Promise<void>>,
  batchSize = 6
): Promise<void> {
  for (let i = 0; i < fns.length; i += batchSize) {
    const slice = fns.slice(i, i + batchSize).map((fn) => fn());
    await Promise.allSettled(slice);
  }
}

/* ---------- Main component ---------- */

export default function HoldingsTable({ uid }: Props) {
  const [rows, setRows] = React.useState<HoldingDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const [sort, setSort] = React.useState<SortState>({
    key: "Ticker",
    dir: "asc",
  });

  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // price caches
  const curCache = React.useRef(new Map<string, number>());
  const closeCache = React.useRef(new Map<string, number>()); // key: TICKER|YYYY-MM-DD -> close
  const [priceTick, setPriceTick] = React.useState(0); // nudge rerender when new prices arrive

  // Precompute business-day anchors for perf windows
  const today = new Date();
  const d1 = prevBizDate(today); // last trading day
  const d5 = nBizDaysAgo(today, 5); // ~ one trading week
  const d1Str = fmt(d1);
  const d5Str = fmt(d5);

  /* ----- Subscribe to Firestore: users/{uid}/holdings ----- */
  React.useEffect(() => {
    if (!uid) return;

    const colRef = collection(db, "users", uid, "holdings");
    const qRef = query(colRef, orderBy("ticker"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const next: HoldingDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          next.push({
            id: docSnap.id,
            ticker: String(d.ticker ?? "").toUpperCase(),
            sector: d.sector ?? "",
            subSector: d.subSector ?? "",
            quantity: Number(d.quantity ?? 0),
            avgCost: Number(d.avgCost ?? 0),
          });
        });
        setRows(next);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load holdings.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  /* ----- Fetch prices for current tickers (Massive) ----- */
  React.useEffect(() => {
    let aborted = false;

    async function run() {
      const tickers = Array.from(
        new Set(rows.map((r) => r.ticker.trim()).filter(Boolean))
      );
      if (!tickers.length) return;

      const tasks: Array<() => Promise<void>> = [];

      for (const tkr of tickers) {
        // latest
        if (!curCache.current.has(tkr)) {
          tasks.push(async () => {
            const v = await fetchCurrentPrice(tkr).catch(() => null);
            if (!aborted && v != null) {
              curCache.current.set(tkr, v);
              setPriceTick((x) => x + 1);
            }
          });
        }

        // 1D / 1W closes
        for (const ds of [d1Str, d5Str]) {
          const key = `${tkr}|${ds}`;
          if (!closeCache.current.has(key)) {
            tasks.push(async () => {
              const v = await fetchClose(tkr, ds).catch(() => null);
              if (!aborted && v != null) {
                closeCache.current.set(key, v);
                setPriceTick((x) => x + 1);
              }
            });
          }
        }
      }

      if (tasks.length) {
        await runInBatches(tasks, 6);
      }
    }

    run();

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows.map((r) => r.ticker).join(","), // rerun when tickers change
    d1Str,
    d5Str,
  ]);

  /* ----- Enrich holdings with prices & returns ----- */
  const enriched: EnrichedHolding[] = React.useMemo(() => {
    return rows.map((r) => {
      const tkr = r.ticker.trim();
      const lastPrice = curCache.current.get(tkr) ?? null;

      const mktValue =
        lastPrice != null && Number.isFinite(r.quantity)
          ? lastPrice * r.quantity
          : null;

      const totalReturnPct =
        lastPrice != null && r.avgCost > 0
          ? pct(r.avgCost, lastPrice)
          : null;

      const d1Close =
        closeCache.current.get(`${tkr}|${d1Str}`) ?? null;
      const d5Close =
        closeCache.current.get(`${tkr}|${d5Str}`) ?? null;

      const todayReturnPct = pct(d1Close, lastPrice);
      const weekReturnPct = pct(d5Close, lastPrice);

      return {
        ...r,
        lastPrice,
        mktValue,
        totalReturnPct,
        todayReturnPct,
        weekReturnPct,
      };
    });
    // priceTick forces recompute when caches update
  }, [rows, priceTick, d1Str, d5Str]);

  /* ----- Sorting ----- */
  const sorted: EnrichedHolding[] = React.useMemo(() => {
    const data = enriched.slice();
    const { key, dir } = sort;

    const numericOrNegInf = (v: number | null | undefined) =>
      typeof v === "number" && Number.isFinite(v)
        ? v
        : Number.NEGATIVE_INFINITY;

    const valueOf = (r: EnrichedHolding): string | number => {
      switch (key) {
        case "Ticker":
          return r.ticker;
        case "Sector":
          return r.sector ?? "";
        case "Sub-Sector":
          return r.subSector ?? "";
        case "Quantity":
          return r.quantity;
        case "Avg Cost":
          return r.avgCost;
        case "Last Price":
          return numericOrNegInf(r.lastPrice);
        case "Mkt Value":
          return numericOrNegInf(r.mktValue);
        case "Total Return (%)":
          return numericOrNegInf(r.totalReturnPct);
        case "Today's Return (%)":
          return numericOrNegInf(r.todayReturnPct);
        case "Weekly Return (%)":
          return numericOrNegInf(r.weekReturnPct);
        default:
          return 0;
      }
    };

    data.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [enriched, sort]);

  const applySort = (s: SortState) => setSort(s);

  /* ----- Selection (for Remove) ----- */

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked =
    sorted.length > 0 &&
    sorted.every((r) => selectedIds.has(r.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allChecked) return new Set();
      const next = new Set<string>();
      for (const r of sorted) next.add(r.id);
      return next;
    });
  };

  /* ----- Add position via HoldingsPopout ----- */

  const handleCreateFromModal = async (values: HoldingsFormValues) => {
    setAddError(null);

    const ticker = values.ticker.trim().toUpperCase();
    const qtyNum = Number(values.quantity);
    const costNum = Number(values.avgCost);

    if (!ticker || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setAddError("Please enter a ticker and a positive quantity.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum <= 0) {
      setAddError("Please enter a positive average cost.");
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "users", uid, "holdings"), {
        ticker,
        sector: values.sector.trim(),
        subSector: values.subSector.trim(),
        quantity: qtyNum,
        avgCost: costNum,
        createdAt: serverTimestamp(),
      });
      setAddOpen(false);
    } catch (err) {
      console.error(err);
      setAddError("Failed to save holding.");
    } finally {
      setSaving(false);
    }
  };

  /* ----- Remove positions ----- */

  const handleRemove = async () => {
    if (!selectedIds.size) return;
    setError(null);

    try {
      setDeleting(true);
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          deleteDoc(doc(db, "users", uid, "holdings", id))
        )
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError("Failed to remove one or more holdings.");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Render ---------- */

  return (
    <div className="wl-card" style={{ marginTop: "1.5rem" }}>
      <HoldingsPopout
        open={addOpen}
        onClose={() => {
          if (!saving) {
            setAddOpen(false);
            setAddError(null);
          }
        }}
        onSave={handleCreateFromModal}
        saving={saving}
        error={addError}
      />

      {/* Toolbar: Add / Remove */}
      <div className="wl-toolbar" style={{ marginBottom: "1rem" }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="wl-btn"
            onClick={() => setAddOpen(true)}
          >
            + Add
          </button>

          <button
            type="button"
            className="wl-btn wl-btn--danger"
            onClick={handleRemove}
            disabled={!selectedIds.size || deleting}
          >
            Remove
          </button>

          {loading && (
            <span className="text-xs text-gray-400">
              Loading holdings…
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="wl-table-wrap custom-scroll">
        <table className="wl-table">
          <thead className="wl-thead">
            <tr className="wl-head-row">
              {/* Checkbox column */}
              <th className="wl-th w-10">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="inline-flex items-center justify-center"
                  title={
                    allChecked ? "Deselect all rows" : "Select all rows"
                  }
                >
                  <input
                    type="checkbox"
                    checked={allChecked}
                    readOnly
                  />
                </button>
              </th>

              <TH
                label="Ticker"
                sortKey="Ticker"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Sector"
                sortKey="Sector"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Sub-Sector"
                sortKey="Sub-Sector"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Quantity"
                sortKey="Quantity"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Last Price"
                sortKey="Last Price"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Avg Cost"
                sortKey="Avg Cost"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Mkt Value"
                sortKey="Mkt Value"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Total Return (%)"
                sortKey="Total Return (%)"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Today's Return (%)"
                sortKey="Today's Return (%)"
                sort={sort}
                applySort={applySort}
              />
              <TH
                label="Weekly Return (%)"
                sortKey="Weekly Return (%)"
                sort={sort}
                applySort={applySort}
              />
            </tr>
          </thead>

          <tbody>
            {sorted.map((r, i) => {
              const zebra =
                i % 2 === 0 ? "wl-row wl-row--even" : "wl-row";

              return (
                <tr key={r.id} className={zebra}>
                  <td className="wl-td w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                    />
                  </td>

                  <td className="wl-td">
                    <div className="wl-td-short font-semibold">
                      {r.ticker}
                    </div>
                  </td>
                  <td className="wl-td">
                    <div className="wl-td-short">{r.sector || "—"}</div>
                  </td>
                  <td className="wl-td">
                    <div className="wl-td-short">
                      {r.subSector || "—"}
                    </div>
                  </td>
                  <td className="wl-td">
                    <div className="wl-td-short">
                      {Number.isFinite(r.quantity)
                        ? r.quantity
                        : "—"}
                    </div>
                  </td>

                  <td className="wl-td">
                    <div className="wl-td-short">
                      {formatCurrency(r.lastPrice)}
                    </div>
                  </td>
                  <td className="wl-td">
                    <div className="wl-td-short">
                      {formatCurrency(r.avgCost)}
                    </div>
                  </td>
                  <td className="wl-td">
                    <div className="wl-td-short">
                      {formatCurrency(r.mktValue)}
                    </div>
                  </td>

                  <td
                    className={`wl-td ${pctClass(
                      r.totalReturnPct
                    )}`}
                  >
                    <div className="wl-td-short">
                      {formatPct(r.totalReturnPct)}
                    </div>
                  </td>
                  <td
                    className={`wl-td ${pctClass(
                      r.todayReturnPct
                    )}`}
                  >
                    <div className="wl-td-short">
                      {formatPct(r.todayReturnPct)}
                    </div>
                  </td>
                  <td
                    className={`wl-td ${pctClass(
                      r.weekReturnPct
                    )}`}
                  >
                    <div className="wl-td-short">
                      {formatPct(r.weekReturnPct)}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={11} className="wl-empty">
                  No holdings yet. Use the <strong>Add</strong> button
                  above to create your first position.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
