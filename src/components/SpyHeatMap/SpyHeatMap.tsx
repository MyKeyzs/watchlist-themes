// src/components/SpyHeatmap.tsx
import React, { useEffect, useMemo, useState } from "react";
import { MASSIVE_API_KEY } from "../../lib/env";
import "./SpyHeatMap.css";

type TickerInput = {
  symbol: string; // e.g. "AAPL"
};

type HeatmapTicker = {
  symbol: string;
  sector: string;
  marketCap: number; // raw market cap from Massive
  dailyChangePct: number; // todaysChangePerc from Massive
};

type SpyHeatmapProps = {
  tickers: TickerInput[]; // S&P list from Sp500YtdPage
  sectorsByTicker: Record<string, string>; // from your Ticker,Sector txt
  onLoaded?: () => void; // called once data is ready
};

/* ---------- Modal helpers ---------- */

type SectorModalRow = {
  symbol: string;
  sector: string;
  marketCap: number | null;
  dailyChangePct: number | null;
};

type SectorModalProps = {
  open: boolean;
  sector: string | null;
  rows: SectorModalRow[];
  onClose: () => void;
};

function SectorModal({ open, sector, rows, onClose }: SectorModalProps) {
  if (!open || !sector) return null;

  return (
    <div className="spyhm-modal-backdrop" onClick={onClose}>
      <div
        className="spyhm-modal"
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        <header className="spyhm-modal__header">
          <h2 className="spyhm-modal__title">{sector}</h2>
          <button className="spyhm-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="spyhm-modal__body">
          <table className="spyhm-modal__table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Daily %</th>
                <th>Market Cap (bn)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.dailyChangePct;
                const isPos = pct != null && pct > 0;
                const isNeg = pct != null && pct < 0;

                return (
                  <tr key={r.symbol}>
                    <td>{r.symbol}</td>
                    <td
                      style={{
                        color: isPos ? "#32e676" : isNeg ? "#ff5c5c" : "#e5e7eb",
                        fontWeight: 600,
                      }}
                    >
                      {pct == null
                        ? "—"
                        : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </td>
                    <td>
                      {r.marketCap == null
                        ? "—"
                        : (r.marketCap / 1e9).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", opacity: 0.7 }}>
                    No data for this sector.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Massive API helpers (daily change + market cap) ---------- */

const MASSIVE_BASE = "https://api.massive.com";

type SnapshotResult = {
  todaysChangePerc: number | null;
};

type RefResult = {
  marketCap: number | null;
};

async function fetchDailySnapshot(symbol: string): Promise<SnapshotResult> {
  // Single-ticker snapshot, returns { ticker: { todaysChangePerc, ... } }
  const url = `${MASSIVE_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(
    symbol
  )}?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { todaysChangePerc: null };
    const json: any = await res.json();
    const pct = json?.ticker?.todaysChangePerc;
    return { todaysChangePerc: typeof pct === "number" ? pct : null };
  } catch {
    return { todaysChangePerc: null };
  }
}

async function fetchMarketCap(symbol: string): Promise<RefResult> {
  // Ticker reference, returns { results: { market_cap: ... } }
  const url = `${MASSIVE_BASE}/v3/reference/tickers/${encodeURIComponent(
    symbol
  )}?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { marketCap: null };
    const json: any = await res.json();
    const mc = json?.results?.market_cap;
    return { marketCap: typeof mc === "number" ? mc : null };
  } catch {
    return { marketCap: null };
  }
}

/* ---------- Tiny "treemap" layout helper ---------- */

type Rect = { x: number; y: number; width: number; height: number };
type LayoutItem = Rect & {
  symbol: string;
  sector: string;
  value: number;
  pct: number | null;
};

/**
 * Vertical treemap inside a sector:
 *  - sector itself is a tall vertical column
 *  - its top-5 tickers are stacked TOP → BOTTOM,
 *    height proportional to market cap, width = full sector width.
 */
function layoutTreemapColumn(
  rect: Rect,
  leaves: { symbol: string; sector: string; value: number; pct: number | null }[]
): LayoutItem[] {
  const total = leaves.reduce(
    (sum, l) => sum + (l.value > 0 ? l.value : 0),
    0
  );

  if (leaves.length === 0) return [];

  // fallback if no market-cap data: equal heights
  if (total <= 0) {
    const h = rect.height / leaves.length;
    return leaves.map((l, idx) => ({
      symbol: l.symbol,
      sector: l.sector,
      pct: l.pct,
      value: 0,
      x: rect.x,
      y: rect.y + idx * h,
      width: rect.width,
      height: h,
    }));
  }

  let cursorY = rect.y;

  return leaves.map((l, idx) => {
    const ratio = (l.value > 0 ? l.value : 0) / total;
    // make last one "absorb" rounding error so we fill the column cleanly
    const h =
      idx === leaves.length - 1
        ? rect.y + rect.height - cursorY
        : rect.height * ratio;

    const item: LayoutItem = {
      symbol: l.symbol,
      sector: l.sector,
      pct: l.pct,
      value: l.value,
      x: rect.x, // full column width
      y: cursorY,
      width: rect.width,
      height: h,
    };

    cursorY += h;
    return item;
  });
}

/* ---------- Main component ---------- */

export default function SpyHeatmap({
  tickers,
  sectorsByTicker,
  onLoaded,
}: SpyHeatmapProps) {
  const [data, setData] = useState<HeatmapTicker[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalSector, setModalSector] = useState<string | null>(null);
  const [modalRows, setModalRows] = useState<SectorModalRow[]>([]);

  // Fetch daily % change + market cap for ALL tickers in the S&P list
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const uniqueSymbols = Array.from(
        new Set(tickers.map((t) => t.symbol.toUpperCase()))
      );

      const results: HeatmapTicker[] = [];
      const MAX_CONCURRENT = 8;
      let index = 0;

      async function worker() {
        while (true) {
          if (cancelled) return;
          const myIndex = index;
          if (myIndex >= uniqueSymbols.length) return;
          index++;

          const symbol = uniqueSymbols[myIndex];
          const sector =
            sectorsByTicker[symbol] ||
            sectorsByTicker[symbol.toUpperCase()] ||
            "Other";

          try {
            const [snap, ref] = await Promise.all([
              fetchDailySnapshot(symbol),
              fetchMarketCap(symbol),
            ]);

            if (cancelled) return;
            results.push({
              symbol,
              sector,
              marketCap: ref.marketCap ?? 0,
              dailyChangePct: snap.todaysChangePerc ?? 0,
            });
          } catch {
            // ignore per-ticker errors
          }
        }
      }

      const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
      await Promise.all(workers);

      if (!cancelled) {
        setData(results);
        setLoading(false);
        onLoaded?.();
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [tickers, sectorsByTicker, onLoaded]);

  /* ---------- Build sector buckets & top-5 per sector ---------- */

  const { sectorOrder, top5BySector, allRowsBySector } = useMemo(() => {
    const sectorMap: Record<string, HeatmapTicker[]> = {};
    for (const row of data) {
      if (!sectorMap[row.sector]) sectorMap[row.sector] = [];
      sectorMap[row.sector].push(row);
    }

    // For modal: full rows (sorted by market cap)
    const allRows: Record<string, SectorModalRow[]> = {};
    Object.entries(sectorMap).forEach(([sector, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => (b.marketCap || 0) - (a.marketCap || 0)
      );
      allRows[sector] = sorted.map((r) => ({
        symbol: r.symbol,
        sector,
        marketCap: r.marketCap || null,
        dailyChangePct:
          typeof r.dailyChangePct === "number" ? r.dailyChangePct : null,
      }));
    });

    // Treemap: only top-5 by market cap per sector
    const top5: Record<string, HeatmapTicker[]> = {};
    Object.entries(sectorMap).forEach(([sector, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => (b.marketCap || 0) - (a.marketCap || 0)
      );
      top5[sector] = sorted.slice(0, 5);
    });

    const order = Object.keys(sectorMap).sort(); // deterministic order

    return {
      sectorOrder: order,
      top5BySector: top5,
      allRowsBySector: allRows,
    };
  }, [data]);

  /* ---------- Derived layout rectangles ---------- */

  const layout = useMemo(() => {
    // outer bounding box is 1000x360 in logical units (we'll scale with CSS)
    const width = 1000;
    const height = 360;

    const sectorRects: {
      sector: string;
      rect: Rect;
      totalValue: number;
      leaves: LayoutItem[];
    }[] = [];

    if (sectorOrder.length === 0) {
      return { width, height, sectors: [] as typeof sectorRects };
    }

    // sector area sized by SUM of ALL market caps in that sector (not just top-5)
    const sectorTotals = sectorOrder.map((sector) => {
      const allRows = allRowsBySector[sector] || [];
      const total = allRows.reduce(
        (sum, r) => sum + (r.marketCap || 0),
        0
      );
      return { sector, total };
    });

    const grandTotal = sectorTotals.reduce(
      (sum, s) => sum + (s.total > 0 ? s.total : 0),
      0
    );

    let cursorX = 0;
    for (const { sector, total } of sectorTotals) {
      const ratio = grandTotal > 0 ? (total > 0 ? total : 0) / grandTotal : 1;
      const w =
        sector === sectorTotals[sectorTotals.length - 1].sector
          ? width - cursorX
          : width * ratio;

      const rect: Rect = { x: cursorX, y: 0, width: w, height };
      cursorX += w;

      const leavesInput = (top5BySector[sector] || []).map((r) => ({
        symbol: r.symbol,
        sector,
        value: r.marketCap || 0,
        pct:
          typeof r.dailyChangePct === "number" ? r.dailyChangePct : null,
      }));

      // **vertical** layout inside each sector column
      const leaves = layoutTreemapColumn(rect, leavesInput);
      sectorRects.push({
        sector,
        rect,
        totalValue: total,
        leaves,
      });
    }

    return { width, height, sectors: sectorRects };
  }, [sectorOrder, allRowsBySector, top5BySector]);

  /* ---------- Click handling ---------- */

  const handleSectorClick = (sector: string) => {
    const rows = allRowsBySector[sector] || [];
    setModalSector(sector);
    setModalRows(rows);
  };

  /* ---------- Color helper ---------- */

  function colorForPct(pct: number | null | undefined): string {
    if (pct == null || !isFinite(pct)) return "#111827"; // neutral
    const c = Math.max(-5, Math.min(5, pct));
    if (c === 0) return "#111827";

    if (c > 0) {
      const t = c / 5; // 0..1
      // dark -> bright green
      return `rgba(${Math.round(16 - 16 * t)}, ${Math.round(
        185 + 40 * t
      )}, ${Math.round(80 - 40 * t)}, 1)`;
    } else {
      const t = -c / 5;
      // dark -> bright red
      return `rgba(${Math.round(160 + 60 * t)}, ${Math.round(
        40 - 20 * t
      )}, ${Math.round(40 - 20 * t)}, 1)`;
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="spyhm-root">
      <header className="spyhm-header">
        <h2 className="spyhm-title">S&amp;P 500 Daily Heatmap</h2>
        <p className="spyhm-subtitle">
          Sized by market cap, colored by daily % move from Massive snapshot.
        </p>
        {!loading && (
          <p className="spyhm-subtitle">
            Loaded {data.length} tickers across {sectorOrder.length} sectors.
          </p>
        )}
      </header>

      {loading && (
        <div className="spyhm-loading">
          Loading daily moves from Massive snapshot…
        </div>
      )}

      {!loading && (
        <div className="spyhm-canvas-wrapper">
          <div
            className="spyhm-canvas"
            style={{
              // logical units (1000x360) get scaled to the container
              aspectRatio: `${layout.width} / ${layout.height}`,
            }}
          >
            {layout.sectors.map((sectorBlock) => {
              const { sector, rect, leaves } = sectorBlock;

              return (
                <div
                  key={sector}
                  className="spyhm-sector"
                  style={{
                    left: `${(rect.x / layout.width) * 100}%`,
                    top: `${(rect.y / layout.height) * 100}%`,
                    width: `${(rect.width / layout.width) * 100}%`,
                    height: `${(rect.height / layout.height) * 100}%`,
                  }}
                >
                  <button
                    className="spyhm-sector__label"
                    onClick={() => handleSectorClick(sector)}
                    title={`Click to see all ${sector} constituents`}
                  >
                    {sector.toUpperCase()}
                  </button>

                  {leaves.map((leaf) => {
                    const pct = leaf.pct;
                    return (
                      <div
                        key={leaf.symbol}
                        className="spyhm-leaf"
                        style={{
                          left: `${((leaf.x - rect.x) / rect.width) * 100}%`,
                          top: `${((leaf.y - rect.y) / rect.height) * 100}%`,
                          width: `${(leaf.width / rect.width) * 100}%`,
                          height: `${(leaf.height / rect.height) * 100}%`,
                          backgroundColor: colorForPct(pct),
                        }}
                      >
                        <div className="spyhm-leaf__ticker">{leaf.symbol}</div>
                        <div className="spyhm-leaf__pct">
                          {pct == null
                            ? "—"
                            : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SectorModal
        open={modalSector != null}
        sector={modalSector}
        rows={modalRows}
        onClose={() => setModalSector(null)}
      />
    </div>
  );
}
