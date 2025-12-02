// src/data/sp500Sectors.ts
// Turns the Ticker,Sector txt into a { [ticker]: sector } map.

import sectorsCsv from "./sp500Sectors.txt?raw";

/**
 * Parse:
 *  Ticker,Sector
 *  WDC,Information Technology
 *  HOOD,Financials
 *  ...
 */
function buildSectorMap(csv: string): Record<string, string> {
  const map: Record<string, string> = {};

  if (!csv) return map;

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length <= 1) return map;

  // Skip header line: "Ticker,Sector"
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // In your txt it's just Ticker,Sector (no extra commas),
    // but we defensively limit to 2 fields.
    const [rawTicker, ...rest] = line.split(",");
    const rawSector = rest.join(",");

    if (!rawTicker || !rawSector) continue;

    const ticker = rawTicker.trim().toUpperCase();
    const sector = rawSector.trim();

    if (ticker) {
      map[ticker] = sector;
    }
  }

  return map;
}

export const sectorMap: Record<string, string> = buildSectorMap(sectorsCsv);