// src/utils/types.ts

// Shape of each CSV/watchlist row
export interface WatchItem {
  Ticker: string;

  Company?: string;
  "Theme(s)"?: string;

  "Thesis Snapshot"?: string;
  "Key 2026 Catalysts"?: string;
  "What Moves It (Triggers)"?: string;
  "Catalyst Path"?: string;
  Notes?: string;

  "Date analyzed"?: string;

  // allow any extra fields the CSV might have
  [key: string]: string | number | undefined;
}

// All sortable column keys (keep ALL of your old ones + new perf cols)
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
  | "Notes"
  | "1Day Change (%)"
  | "1Week Change (%)"
  | "YTD Change (%)";

export type SortDir = "asc" | "desc";

export type SortState = {
  key: SortKey;
  dir: SortDir;
};