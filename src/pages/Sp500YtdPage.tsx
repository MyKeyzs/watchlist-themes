// src/pages/Sp500YtdPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { MASSIVE_API_KEY } from "../lib/env";
import sp500Html from "../data/sANDp500.txt?raw"; // same file as before for ticker list
import PopoutModal from "../components/PopoutModal/PopoutModal";
import SpyHeatmap from "../components/SpyHeatMap/SpyHeatMap";
import { sectorMap } from "../data/sp500Sectors";

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

/* ---------- Massive: /v1/open-close helper ---------- */

const MASSIVE_BASE = "https://api.massive.com";

type DailyOC = { open: number | null; close: number | null };

async function fetchDailyOpenClose(
  ticker: string,
  yyyy_mm_dd: string
): Promise<DailyOC> {
  const url =
    `${MASSIVE_BASE}/v1/open-close/${encodeURIComponent(
      ticker
    )}/${yyyy_mm_dd}` + `?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { open: null, close: null };
    const json: any = await res.json();
    const openRaw = json?.open ?? json?.o;
    const closeRaw = json?.close ?? json?.c;
    return {
      open: typeof openRaw === "number" ? openRaw : null,
      close: typeof closeRaw === "number" ? closeRaw : null,
    };
  } catch {
    return { open: null, close: null };
  }
}

async function fetchYtdMetrics(
  ticker: string,
  from: string,
  to: string
): Promise<Metrics> {
  const [start, end] = await Promise.all([
    fetchDailyOpenClose(ticker, from),
    fetchDailyOpenClose(ticker, to),
  ]);

  const open = start.open;
  const close = end.close;

  if (open == null || close == null || open === 0) {
    return { current: close, ytdPct: null };
  }

  const ytdPct = ((close - open) / open) * 100;
  return { current: close, ytdPct };
}

/* ---------- Date helpers (LOCAL time, not UTC) ---------- */

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay(); // 0 = Sun, 6 = Sat (LOCAL)
  return day === 0 || day === 6;
}

function firstBizDayOfYear(year: number): Date {
  // Jan 2 in *local* time
  const d = new Date(year, 0, 2);
  while (isWeekend(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function lastBizDayOnOrBefore(date: Date): Date {
  // Strip time, keep local Y/M/D
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (isWeekend(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

const MAX_CONCURRENT = 8; // throttle workers

/* ---------- Main component ---------- */

export default function Sp500YtdPage() {
  const [metrics, setMetrics] = useState<Record<string, Metrics>>({});
  const [loadedCount, setLoadedCount] = useState(0);

  const [heatmapReady, setHeatmapReady] = useState(false);

  // popout modal state (same as before)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState<string>("");
  const [modalThesis, setModalThesis] = useState<string>("");
  const [modalCatalysts, setModalCatalysts] = useState<string>("");
  const [modalWhatMoves, setModalWhatMoves] = useState<string>("");

  const openModalForSymbol = (symbol: string) => {
    setModalTicker(symbol);
    setModalThesis("");
    setModalCatalysts("");
    setModalWhatMoves("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear(); // LOCAL year

  const fromDate = firstBizDayOfYear(year);
  const toDate = lastBizDayOnOrBefore(today);

  const fromStr = fmtDate(fromDate);
  const toStr = fmtDate(toDate);

  // YTD fetcher – only after heatmap has finished loading
  useEffect(() => {
    if (!heatmapReady) return;

    let cancelled = false;

    setMetrics({});
    setLoadedCount(0);

    async function run() {
      let index = 0;
      const total = SP500_LIST.length;

      async function worker() {
        while (true) {
          if (cancelled) return;
          const myIndex = index;
          if (myIndex >= total) return;
          index++;

          const { symbol } = SP500_LIST[myIndex];

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
  }, [fromStr, toStr, heatmapReady]);

  // Build sorted rows with computed YTD %
  const rows = useMemo(() => {
    return SP500_LIST.map((entry) => {
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
  }, [metrics]);

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
            Loaded {loadedCount} / {SP500_LIST.length} tickers…
          </p>
        </header>

      

        {/* ---------- YTD TABLE (only after heatmap ready) ---------- */}
      
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
