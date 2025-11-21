import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
    createChart,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts";
import "./PopoutChart.css";
import { MASSIVE_API_KEY as POLY_KEY } from "../../lib/env";

type SeriesKind = "Candlestick" | "Line";
type TFrame = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD";

interface Props {
  ticker: string;
}

const PopoutChart: React.FC<Props> = ({ ticker }) => {
  const [timeframe, setTimeframe] = useState<TFrame>("YTD");
  const [chartType, setChartType] = useState<"candlestick" | "line">(
    "candlestick"
  );
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesKind> | null>(null);

  const polygonQuery = useMemo(() => {
    const now = new Date();
    let from = new Date();
    let mult = 1;
    let span: "minute" | "hour" | "day" = "day";

    switch (timeframe) {
      case "1D":
        span = "minute";
        mult = 5;
        from = new Date(now);
        from.setDate(now.getDate() - 1);
        break;
      case "1W":
        span = "minute";
        mult = 30;
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        break;
      case "1M":
        from = new Date(now);
        from.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        from = new Date(now);
        from.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        from = new Date(now);
        from.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        from = new Date(now);
        from.setFullYear(now.getFullYear() - 1);
        break;
      case "YTD":
        span = "day";
        mult = 1;
        from = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { mult, span, from: fmt(from), to: fmt(now) };
  }, [timeframe]);

  // Fetch Polygon data
  useEffect(() => {
    let aborted = false;
    async function fetchData() {
      setError(null);
      try {
        const { mult, span, from, to } = polygonQuery;
        const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
          ticker
        )}/range/${mult}/${span}/${from}/${to}?adjusted=true&limit=50000&apiKey=${encodeURIComponent(
          POLY_KEY
        )}`;
        const resp = await axios.get(url);
        const results = resp.data?.results ?? [];

        const mapped =
          chartType === "candlestick"
            ? results.map((r: any) => ({
                time: Math.floor(r.t / 1000),
                open: r.o,
                high: r.h,
                low: r.l,
                close: r.c,
              }))
            : results.map((r: any) => ({
                time: Math.floor(r.t / 1000),
                value: r.c,
              }));

        if (!aborted) setData(mapped);
      } catch (e) {
        if (!aborted) setError("Error fetching chart data.");
        console.error(e);
      }
    }
    if (ticker) fetchData();
    return () => {
      aborted = true;
    };
  }, [ticker, chartType, polygonQuery]);

  // Init chart & series (v5 addSeries API)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!chartRef.current) {
      chartRef.current = createChart(el, {
        width: el.clientWidth,
        height: el.clientHeight,
        layout: {
          background: { color: "#0e1320" },
          textColor: "#d0d6e1",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        },
        grid: {
          vertLines: { color: "#2b3244" },
          horzLines: { color: "#2b3244" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#93c5fd55", labelBackgroundColor: "#0ea5e9" },
          horzLine: { color: "#93c5fd", labelBackgroundColor: "#0ea5e9" },
        },
        timeScale: { borderColor: "#3a4155" },
        rightPriceScale: {
          borderColor: "#3a4155",
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
      });

      const ro = new ResizeObserver(() => {
        const c = containerRef.current;
        if (c && chartRef.current) {
          chartRef.current.applyOptions({
            width: c.clientWidth,
            height: c.clientHeight,
          });
        }
      });
      ro.observe(el);
      // @ts-expect-error store for cleanup
      chartRef.current.__ro = ro;
    }

    // replace the "add new series based on type" block with this:

// remove old
if (seriesRef.current && chartRef.current) {
  chartRef.current.removeSeries(seriesRef.current);
  seriesRef.current = null!;
}

// add new (v5 syntax)
if (chartRef.current) {
  seriesRef.current =
    chartType === "candlestick"
      ? (chartRef.current.addSeries(CandlestickSeries) as ISeriesApi<"Candlestick">)
      : (chartRef.current.addSeries(LineSeries) as ISeriesApi<"Line">);
}

// style AFTER creation
if (seriesRef.current) {
  if (chartType === "candlestick") {
    seriesRef.current.applyOptions({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
  } else {
    seriesRef.current.applyOptions({
      lineWidth: 2,
    });
  }
}

// seed data
if (seriesRef.current && data.length) {
  seriesRef.current.setData(data as any);
  chartRef.current?.timeScale().fitContent();
}

    return () => {
      if (seriesRef.current && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
    };
  }, [chartType]);

  // update data
  useEffect(() => {
    if (seriesRef.current && data.length) {
      seriesRef.current.setData(data as any);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div className="wl-popchart-root">
      <div className="wl-popchart-toolbar">
        <div className="wl-popchart-timeframes">
          {(["1D", "1W", "1M", "3M", "6M", "1Y", "YTD"] as TFrame[]).map(
            (tf) => (
              <button
                key={tf}
                className={`wl-popchart-btn ${timeframe === tf ? "is-on" : ""}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            )
          )}
        </div>
        <div className="wl-popchart-type">
          <button
            className={`wl-popchart-btn ${chartType === "line" ? "is-on" : ""}`}
            onClick={() => setChartType("line")}
          >
            Line
          </button>
          <button
            className={`wl-popchart-btn ${
              chartType === "candlestick" ? "is-on" : ""
            }`}
            onClick={() => setChartType("candlestick")}
          >
            Candles
          </button>
        </div>
        <span className="wl-popchart-ticker">{ticker}</span>
      </div>

      {error ? (
        <div className="wl-popchart-error">{error}</div>
      ) : (
        <div ref={containerRef} className="wl-popchart-canvas" />
      )}
    </div>
  );
};

export default PopoutChart;
