import React from "react";
import SpyHeatmap from "../components/SpyHeatMap/SpyHeatMap";
import sp500Html from "../data/sANDp500.txt?raw";
import { sectorMap } from "../data/sp500Sectors";

/* ---------- Types ---------- */

type Sp500Entry = {
  symbol: string;
  company: string;
};

/* ---------- Parse the sANDp500.txt file once (same pattern as YTD page) ---------- */

function parseSp500(html: string): Sp500Entry[] {
  const rows: Sp500Entry[] = [];
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

/* ---------- Page component ---------- */

export default function Sp500HeatmapPage() {
  return (
    <div className="wl-page">
      {/* SpyHeatmap renders its own header + layout */}
      <SpyHeatmap
        tickers={SP500_LIST.map((e) => ({ symbol: e.symbol }))}
        sectorsByTicker={sectorMap}
      />
    </div>
  );
}