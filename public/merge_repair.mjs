// Merge your original watchlist CSV with bingbongg.csv WITHOUT losing old themes.
// - Keeps all existing rows
// - Adds new tickers
// - Theme(s) = union(old, new) with dedupe, joined by " | "
// - Catalyst Path = keep old if present, else new
// - Date analyzed = "10/29" for preexisting tickers; new tickers use their own date (MM/DD if we can parse)
// Output: public/watchlist_web.csv

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import iconv from "iconv-lite";

const BASE = path.resolve("public");

// Adjust this if your “full” original CSV has a different name
const ORIG_CANDIDATES = [
  "permanent_thematic_watchlist_2026_merged_from_excel.csv",
  "permanent_thematic_watchlist_2026_with_catalyst_path.csv",
  "watchlist_web.csv", // fallback if you've already got one
];
const NEW = "bingbongg.csv";
const OUT = "watchlist_web.csv";

function findFirstExisting(basenames) {
  for (const b of basenames) {
    const p = path.join(BASE, b);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const ORIG = findFirstExisting(ORIG_CANDIDATES);
if (!ORIG) {
  console.error(
    `Could not find any base CSV in ${BASE}. Expected one of:\n` +
    ORIG_CANDIDATES.map((n) => ` - ${n}`).join("\n")
  );
  process.exit(1);
}
const NEWPATH = path.join(BASE, NEW);
const OUTPATH = path.join(BASE, OUT);

function readCSV(file, encoding = "utf8") {
  const buf = fs.readFileSync(file);
  const text = encoding === "utf8" ? buf.toString("utf8") : iconv.decode(buf, encoding);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data.map((row) => {
    const obj = {};
    for (const k in row) obj[k?.trim?.() ?? k] = (row[k] ?? "").toString();
    return obj;
  });
}

function writeCSV(file, rows) {
  const csv = Papa.unparse(rows);
  fs.writeFileSync(file, csv);
}

function cleanTicker(s) {
  const t = (s ?? "").toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, "");
  return t || "";
}

// Robust, **no-destructuring** date normalizer → "MM/DD" or ""
function toMMDD(s) {
  const v = (s ?? "").trim();
  if (!v) return "";
  // already looks like M/D
  if (/^\d{1,2}\/\d{1,2}$/.test(v)) return v;
  // try native Date (handles most yyyy-mm-dd and mm/dd/yyyy)
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  }
  // try simple yyyy-mm-dd manually
  const m1 = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) {
    const mm = String(Number(m1[2])).padStart(2, "0");
    const dd = String(Number(m1[3])).padStart(2, "0");
    return `${mm}/${dd}`;
  }
  // try mm/dd/yyyy
  const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/);
  if (m2) {
    const mm = String(Number(m2[1])).padStart(2, "0");
    const dd = String(Number(m2[2])).padStart(2, "0");
    return `${mm}/${dd}`;
  }
  return ""; // give up
}

function splitThemes(s) {
  return (s || "")
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function mergeThemes(a, b) {
  const seen = new Set();
  const out = [];
  for (const x of [...splitThemes(a), ...splitThemes(b)]) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out.join(" | ");
}

function ensureCols(row) {
  for (const k of [
    "Ticker",
    "Company",
    "Theme(s)",
    "Thesis Snapshot",
    "Key 2026 Catalysts",
    "What Moves It (Triggers)",
    "Notes",
    "Catalyst Path",
    "Date analyzed",
  ]) {
    if (!(k in row)) row[k] = row[k] ?? "";
  }
  return row;
}

// 1) Load base CSV (the one that had ALL your themes)
const baseRowsRaw = readCSV(ORIG);
const baseRows = baseRowsRaw
  .map((r) => {
    const row = ensureCols({ ...r });
    row["Ticker"] = cleanTicker(row["Ticker"]);
    return row;
  })
  .filter((r) => r["Ticker"]);

const preexisting = new Set(baseRows.map((r) => r["Ticker"]));

// 2) Load the new CSV (bingbongg.csv) — often windows-1252
if (!fs.existsSync(NEWPATH)) {
  console.error(`Missing ${NEWPATH}. Put your new CSV there and rerun.`);
  process.exit(1);
}
const src = readCSV(NEWPATH, "windows-1252");
const srcCols = Object.keys(src[0] || {});
const pick = (columns, ...cands) => {
  for (const want of cands) {
    const exact = columns.find((c) => c === want);
    if (exact) return exact;
  }
  for (const c of columns) {
    for (const pat of cands) {
      if (new RegExp(pat, "i").test(c)) return c;
    }
  }
  return null;
};

const tcol = pick(srcCols, "Ticker", "symbol", "^tkr$") ?? "Ticker";
const themec = pick(srcCols, "Theme(s)", "Theme", "Theme Alignment") ?? "Theme";
const catc = pick(srcCols, "Catalyst Path", "catalyst.*path", "milestone", "event.*path") ?? "Catalyst Path";
const datec = pick(srcCols, "Date analyzed", "Date Analyzed", "Date\\s*Analy(z|s)ed") ?? "Date Analyzed";

const newRows = src
  .map((r) => ({
    "Ticker": cleanTicker(r[tcol]),
    "Theme(s)": (r[themec] ?? "").toString(),
    "Catalyst Path": (r[catc] ?? "").toString(),
    "Date analyzed": toMMDD(r[datec]),
  }))
  .filter((r) => r["Ticker"]);

const newByTicker = new Map(newRows.map((r) => [r["Ticker"], r]));

// 3) Union + coalesce
const tickers = Array.from(new Set([...baseRows.map((r) => r["Ticker"]), ...newRows.map((r) => r["Ticker"])]));
const out = tickers
  .map((t) => {
    const o = baseRows.find((r) => r["Ticker"] === t) || {};
    const n = newByTicker.get(t) || {};
    const row = ensureCols({
      "Ticker": t,
      "Company": o["Company"] ?? "",
      "Theme(s)": mergeThemes(o["Theme(s)"], n["Theme(s)"]),
      "Thesis Snapshot": o["Thesis Snapshot"] ?? "",
      "Key 2026 Catalysts": o["Key 2026 Catalysts"] ?? "",
      "What Moves It (Triggers)": o["What Moves It (Triggers)"] ?? "",
      "Notes": o["Notes"] ?? "",
      "Catalyst Path": (o["Catalyst Path"] || n["Catalyst Path"] || ""),
      "Date analyzed": preexisting.has(t) ? "10/29" : (n["Date analyzed"] || o["Date analyzed"] || ""),
    });
    return row;
  })
  .sort(
    (a, b) =>
      (a["Theme(s)"] || "").localeCompare(b["Theme(s)"] || "") ||
      a.Ticker.localeCompare(b.Ticker)
  );

// 4) Write output used by the webpage
writeCSV(OUTPATH, out);
console.log(`Wrote ${path.relative(process.cwd(), OUTPATH)} with ${out.length} rows.`);
console.log(`Base: ${path.basename(ORIG)} | New: ${path.basename(NEWPATH)}`);
