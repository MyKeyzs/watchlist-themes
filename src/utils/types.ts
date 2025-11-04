export type WatchItem = {
  Ticker: string;
  Company: string;
  "Theme(s)": string;
  "Thesis Snapshot": string;
  "Key 2026 Catalysts": string;
  "What Moves It (Triggers)": string;
  "Catalyst Path"?: string;
  Notes: string;
  "Date analyzed": string;          // keep as string for your MM-DD style
  "Initial Price"?: number;         // if/when you add it
};

export type SortKey =
  | "Ticker"
  | "Company"
  | "Theme(s)"
  | "Date analyzed"
  | "Thesis Snapshot"
  | "Key 2026 Catalysts"
  | "What Moves It (Triggers)"
  | "Catalyst Path"
  | "Notes"
  | "Initial Price";                // include if you sort by it

export type SortDir = "asc" | "desc";

export type SortState = {
  key: SortKey;
  dir: SortDir;
};