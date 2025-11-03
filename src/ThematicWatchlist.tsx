import React, { useEffect, useMemo, useState } from "react";
import "./styles/watchlist.light.css";

/* ---------- Types ---------- */
export type WatchItem = {
  Ticker: string;
  Company: string;
  "Theme(s)": string;
  "Thesis Snapshot": string;
  "Key 2026 Catalysts": string;
  "What Moves It (Triggers)": string;
  "Catalyst Path"?: string;
  Notes?: string;
  "Date analyzed"?: string; // parsed from CSV (even if it's the last column)
};

type Sort = { key: keyof WatchItem; dir: "asc" | "desc" } | null;

/* Utility: build TradingView URL */
function tvUrl(t: string) {
  const ticker = (t || "").trim();
  return `https://www.tradingview.com/chart/WiBJEuAh/?symbol=${encodeURIComponent(
    ticker
  )}`;
}

/* Split comma/pipe separated themes */
const splitThemes = (s: string) =>
  (s || "")
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function ThematicWatchlist({
  title = "Permanent Thematic Watchlist",
  csvUrl = "/permanent_thematic_watchlist_2026_merged_from_excel.csv",
}: {
  title?: string;
  csvUrl?: string;
}) {
  /* ---------- State ---------- */
  const [rows, setRows] = useState<WatchItem[]>([]);
  const [q, setQ] = useState("");
  const [themesSelected, setThemesSelected] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>({ key: "Ticker", dir: "asc" });

  /* ---------- Load CSV ---------- */
  useEffect(() => {
    (async () => {
      const Papa = (await import("papaparse")).default;
      const res = await fetch(csvUrl, { cache: "no-cache" });
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rs = (parsed.data as any[]).map((r) => ({
        Ticker: (r.Ticker ?? "").trim(),
        Company: (r.Company ?? "").trim(),
        "Theme(s)": (r["Theme(s)"] ?? "").trim(),
        "Thesis Snapshot": (r["Thesis Snapshot"] ?? "").trim(),
        "Key 2026 Catalysts": (r["Key 2026 Catalysts"] ?? "").trim(),
        "What Moves It (Triggers)":
          (r["What Moves It (Triggers)"] ?? "").trim(),
        "Catalyst Path": (r["Catalyst Path"] ?? "").trim(),
        Notes: (r["Notes"] ?? "").trim(),
        "Date analyzed": (r["Date analyzed"] ?? "").trim(),
      })) as WatchItem[];
      setRows(rs);
    })().catch(console.error);
  }, [csvUrl]);

  /* ---------- Theme list ---------- */
  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );

  const isAllSelected =
    allThemes.length > 0 && themesSelected.length === allThemes.length;

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (themesSelected.length === 0) return [];

    let data = rows.filter((r) => {
      const matchesTheme = splitThemes(r["Theme(s)"]).some((t) =>
        themesSelected.includes(t)
      );
      if (!matchesTheme) return false;

      if (!needle) return true;

      const hay = [
        r.Ticker,
        r.Company,
        r["Theme(s)"],
        r["Date analyzed"] ?? "",
        r["Thesis Snapshot"],
        r["Key 2026 Catalysts"],
        r["What Moves It (Triggers)"],
        r["Catalyst Path"] ?? "",
        r.Notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });

    if (sort) {
      const { key, dir } = sort;
      data = data.slice().sort((a, b) => {
        const av = String(a[key] ?? "").toLowerCase();
        const bv = String(b[key] ?? "").toLowerCase();
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [rows, q, themesSelected, sort]);

  /* ---------- Theme selection ---------- */
  const toggleTheme = (t: string) => {
    const isActive = themesSelected.includes(t);
    if (isActive) {
      const next = themesSelected.filter((x) => x !== t);
      setThemesSelected(next);
      if (currentTheme === t) setCurrentTheme(next.length ? next[next.length - 1] : null);
    } else {
      const next = [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(t); // newest selection is "current" (blue)
    }
  };

  const clearThemes = () => {
    setThemesSelected([]);
    setCurrentTheme(null);
  };

  const toggleAllThemes = () => {
    if (isAllSelected) {
      setThemesSelected([]);
      setCurrentTheme(null);
    } else {
      setThemesSelected(allThemes);
      setCurrentTheme(null);
    }
  };

  /* ---------- Sort helper ---------- */
  const clickSort = (key: keyof WatchItem) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  /* ---------- UI ---------- */
  return (
    <div className="wl-root">
      <div className="wl-container">
        {/* Title & Search */}
        <div className="wl-toolbar">
          <div>
            <h1 className="wl-title">{title}</h1>
            <p className="wl-subtitle">
              Current theme = <span className="text-blue-600">blue outline</span>; latest selection ={" "}
              <span className="text-green-600">green</span>. “All themes” toggles select-all ↔ none.
            </p>
          </div>
          <div className="wl-search-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search within selected themes…"
              className="wl-search"
            />
            {q && (
              <button onClick={() => setQ("")} className="wl-btn">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Theme pills */}
        <div className="wl-themes-outer">
          <div className="wl-themes">
            {/* All themes */}
            <div className="wl-chip-row">
              <button
                onClick={toggleAllThemes}
                className={`wl-pill wl-pill--all`}
                title={isAllSelected ? "Deselect all themes" : "Select all themes"}
              >
                All themes
              </button>
              <button onClick={clearThemes} className="wl-clear">Clear themes</button>
            </div>

            {/* Individual themes */}
            <div className="wl-chip-row">
              {allThemes.map((t) => {
                const isSelected = themesSelected.includes(t);
                const isCurrent = isSelected && currentTheme === t;
                const cls = isSelected
                  ? isCurrent
                    ? "wl-pill wl-pill--current"
                    : "wl-pill wl-pill--prev"
                  : "wl-pill wl-pill--idle";
                return (
                  <button
                    key={t}
                    onClick={() => toggleTheme(t)}
                    className={cls}
                    title={isSelected ? "Click to deselect" : "Click to select"}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="wl-card">
          <div className="wl-table-wrap">
            <table className="wl-table">
            <thead className="wl-thead">
              <tr className="wl-head-row">
                {TH("Ticker", "Ticker", () => clickSort("Ticker"), sort, "sticky left-0 z-30")}
                {TH("Company", "Company", () => clickSort("Company"), sort)}
                {TH("Theme(s)", "Theme(s)", () => clickSort("Theme(s)"), sort)}
                {TH("Date analyzed", "Date analyzed", () => clickSort("Date analyzed"), sort)}
                {TH("Thesis Snapshot", "Thesis", () => clickSort("Thesis Snapshot"), sort)}
                {TH("Key 2026 Catalysts", "2026 Catalysts", () => clickSort("Key 2026 Catalysts"), sort)}
                {TH("What Moves It (Triggers)", "What Moves It", () => clickSort("What Moves It (Triggers)"), sort)}
                {TH("Catalyst Path", "Catalyst Path", () => clickSort("Catalyst Path"), sort)}
                {TH("Notes", "Notes", () => clickSort("Notes"), sort)}
              </tr>
            </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const zebra = i % 2 === 0 ? "wl-row wl-row--even" : "wl-row";
                  return (
                    <tr key={`${r.Ticker}-${i}`} className={zebra}>
                      {/* TICKER: opens TradingView in new tab */}
                      <td className="wl-ticker-cell" title={`Open ${r.Ticker} on TradingView`}>
                        {r.Ticker ? (
                          <a
                            href={tvUrl(r.Ticker)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="wl-ticker-chip"
                          >
                            {r.Ticker}
                          </a>
                        ) : (
                          <span className="wl-ticker-chip">—</span>
                        )}
                      </td>

                      <TD value={r.Company} />
                      <TD value={r["Theme(s)"]} raw={r["Theme(s)"]} />
                      <TD value={r["Date analyzed"] ?? ""} />
                      <TD value={r["Thesis Snapshot"]} long />
                      <TD value={r["Key 2026 Catalysts"]} long />
                      <TD value={r["What Moves It (Triggers)"]} long />
                      <TD value={r["Catalyst Path"] ?? ""} long />
                      <TD value={r.Notes ?? ""} long />
                    </tr>
                  );
                })}

                {themesSelected.length === 0 && (
                  <tr>
                    <td colSpan={9} className="wl-empty">
                      No themes selected. Pick one above to populate the table.
                    </td>
                  </tr>
                )}

                {themesSelected.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="wl-empty">
                      No results within the selected theme(s). Try clearing the search box.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count */}
        <div className="wl-count">
          {themesSelected.length === 0
            ? <>No themes selected</>
            : <>Showing <span className="text-gray-900">{filtered.length}</span> item{filtered.length === 1 ? "" : "s"}</>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function TH(
  key: keyof WatchItem,
  label: string,
  onClick: () => void,
  sort: Sort,
  extra?: string
) {
  const active = sort && sort.key === key;
  return (
    <th className={`wl-th ${extra ?? ""}`}>
      <button onClick={onClick} className="wl-th-btn group" title="Click to sort">
        <span>{label}</span>
        <span className={`wl-th-caret ${active ? "wl-th-caret--on" : ""}`}>
          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function TD({ value, raw, long }: { value: React.ReactNode | string; raw?: string; long?: boolean }) {
  return (
    <td className="wl-td" title={typeof value === "string" ? value : raw}>
      <div className={long ? "wl-td-long" : "wl-td-short"}>{value || "—"}</div>
    </td>
  );
}
