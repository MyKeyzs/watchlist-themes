import React, { useEffect, useMemo, useState } from "react";

/* ---------- Types ---------- */
export type WatchItem = {
  Ticker: string;
  Company: string;
  "Theme(s)": string;
  "Date analyzed"?: string;
  "Thesis Snapshot": string;
  "Key 2026 Catalysts": string;
  "What Moves It (Triggers)": string;
  "Catalyst Path"?: string;
  Notes: string;
};

type Sort = { key: keyof WatchItem; dir: "asc" | "desc" } | null;

/* ---------- Helpers ---------- */
const splitThemes = (s: string) =>
  (s || "")
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);

const sortIcon = (active: boolean, dir?: "asc" | "desc") =>
  active ? (dir === "asc" ? "▲" : "▼") : "▾";

/* ---------- Component ---------- */
export default function ThematicWatchlist({
  title = "Permanent Thematic Watchlist",
  csvUrl = "/permanent_thematic_watchlist_2026_merged_from_excel.csv",
  linkedinUrl = "https://www.linkedin.com/in/mmiamckinmmckiney/",
  twitterUrl = "https://twitter.com/mmykeyy",
}: {
  title?: string;
  csvUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
}) {
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
        "Date analyzed": (r["Date analyzed"] ?? r["Date Analyzed"] ?? "").trim(),
        "Thesis Snapshot": (r["Thesis Snapshot"] ?? "").trim(),
        "Key 2026 Catalysts": (r["Key 2026 Catalysts"] ?? "").trim(),
        "What Moves It (Triggers)": (r["What Moves It (Triggers)"] ?? "").trim(),
        "Catalyst Path": (r["Catalyst Path"] ?? "").trim(),
        Notes: (r["Notes"] ?? "").trim(),
      })) as WatchItem[];
      setRows(rs);
    })().catch(console.error);
  }, [csvUrl]);

  /* ---------- Theme lists ---------- */
  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );
  const isAllSelected =
    allThemes.length > 0 && themesSelected.length === allThemes.length;

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (themesSelected.length === 0) return []; // empty table when none selected

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
        r["Thesis Snapshot"],
        r["Key 2026 Catalysts"],
        r["What Moves It (Triggers)"],
        r["Catalyst Path"] ?? "",
        r.Notes ?? "",
        r["Date analyzed"] ?? "",
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
      if (currentTheme === t)
        setCurrentTheme(next.length ? next[next.length - 1] : null);
    } else {
      const next = [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(t); // latest = current (green)
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

  /* ---------- Sorting ---------- */
  const clickSort = (key: keyof WatchItem) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  /* ---------- TradingView on ticker click ---------- */
  const openTV = (ticker: string) => {
    if (!ticker) return;
    const url = `https://www.tradingview.com/chart/WiBJEuAh/?symbol=${encodeURIComponent(
      ticker
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ---------- Render ---------- */
  return (
    <div className="wl-root">
      <div className="wl-container">
        {/* Title & Search */}
        <div className="wl-toolbar">
          <div>
            <h1 className="wl-title">{title}</h1>
            <p className="wl-subtitle">
              Current theme = <span className="text-blue-600">blue outline</span>; latest
              selection = <span className="text-green-700 font-medium">green</span>. “All
              themes” toggles select-all ↔ none.
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
              <button className="wl-btn" onClick={() => setQ("")}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Theme chips */}
        <div className="wl-themes-outer">
          <div className="wl-themes">
            {/* All themes */}
            <div className="wl-chip-row">
              <button
                onClick={toggleAllThemes}
                className={`wl-pill wl-pill--all`}
                title={
                  isAllSelected ? "Deselect all themes" : "Select all available themes"
                }
              >
                All themes
              </button>
              <button onClick={clearThemes} className="wl-clear">
                Clear themes
              </button>
            </div>

            {/* Buckets (single row container is fine) */}
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

        {/* Table card */}
        <div className="wl-card">
          <div className="wl-table-wrap">
            <table className="wl-table">
              <thead className="wl-thead">
                <tr className="wl-head-row">
                  <TH
                    label="Ticker"
                    onClick={() => clickSort("Ticker")}
                    sort={sort}
                    sortKey="Ticker"
                    sticky
                  />
                  <TH
                    label="Company"
                    onClick={() => clickSort("Company")}
                    sort={sort}
                    sortKey="Company"
                  />
                  <TH
                    label="Theme(s)"
                    onClick={() => clickSort("Theme(s)")}
                    sort={sort}
                    sortKey="Theme(s)"
                  />
                  <TH
                    label="Date analyzed"
                    onClick={() => clickSort("Date analyzed")}
                    sort={sort}
                    sortKey="Date analyzed"
                  />
                  <TH
                    label="Thesis"
                    onClick={() => clickSort("Thesis Snapshot")}
                    sort={sort}
                    sortKey="Thesis Snapshot"
                  />
                  <TH
                    label="2026 Catalysts"
                    onClick={() => clickSort("Key 2026 Catalysts")}
                    sort={sort}
                    sortKey="Key 2026 Catalysts"
                  />
                  <TH
                    label="What Moves It"
                    onClick={() => clickSort("What Moves It (Triggers)")}
                    sort={sort}
                    sortKey="What Moves It (Triggers)"
                  />
                  <TH
                    label="Catalyst Path"
                    onClick={() => clickSort("Catalyst Path")}
                    sort={sort}
                    sortKey="Catalyst Path"
                  />
                  <TH
                    label="Notes"
                    onClick={() => clickSort("Notes")}
                    sort={sort}
                    sortKey="Notes"
                  />
                </tr>
              </thead>

              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={`${r.Ticker}-${i}`}
                    className={`wl-row ${i % 2 === 0 ? "wl-row--even" : ""}`}
                  >
                    <td className="wl-ticker-cell" title={r.Ticker}>
                      <button
                        onClick={() => openTV(r.Ticker)}
                        className="wl-ticker-chip"
                        title="Open in TradingView"
                      >
                        {r.Ticker || "—"}
                      </button>
                    </td>
                    <Cell value={r.Company} />
                    <Cell value={r["Theme(s)"]} raw={r["Theme(s)"]} />
                    <Cell value={r["Date analyzed"] ?? ""} />
                    <Cell value={r["Thesis Snapshot"]} long />
                    <Cell value={r["Key 2026 Catalysts"]} long />
                    <Cell value={r["What Moves It (Triggers)"]} long />
                    <Cell value={r["Catalyst Path"] ?? ""} long />
                    <Cell value={r.Notes} long />
                  </tr>
                ))}

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
                      No results within the selected theme(s). Try clearing the search
                      box.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count */}
        <div className="wl-count">
          {themesSelected.length === 0 ? (
            <>No themes selected</>
          ) : (
            <>
              Showing <span className="text-gray-700">{filtered.length}</span>{" "}
              item{filtered.length === 1 ? "" : "s"}
            </>
          )}
        </div>

        {/* Footer — set your real profile URLs in props or here */}
        <SiteFooter linkedin={linkedinUrl} twitter={twitterUrl} />
      </div>
    </div>
  );
}

/* ---------- Small table helpers ---------- */

function TH({
  label,
  onClick,
  sort,
  sortKey,
  sticky,
}: {
  label: string;
  onClick: () => void;
  sort: Sort;
  sortKey: keyof WatchItem;
  sticky?: boolean;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={`wl-th ${sticky ? "sticky left-0 z-30 bg-gray-100/80" : ""}`}>
      <button className="wl-th-btn group" onClick={onClick}>
        <span>{label}</span>
        <span className={`wl-th-caret ${active ? "wl-th-caret--on" : ""}`}>
          {sortIcon(!!active, sort?.dir)}
        </span>
      </button>
    </th>
  );
}

function Cell({
  value,
  raw,
  long,
}: {
  value: React.ReactNode | string;
  raw?: string;
  long?: boolean;
}) {
  return (
    <td className="wl-td" title={typeof value === "string" ? value : raw}>
      <div className={long ? "wl-td-long" : "wl-td-short"}>{value || "—"}</div>
    </td>
  );
}

/* --- Social footer (drop-in) ------------------------------------------- */

function SiteFooter({
  twitter,
  linkedin,
}: {
  twitter: string;
  linkedin: string;
}) {
  return (
    <footer className="wl-footer">
      <span className="wl-footer-copy">
        © {new Date().getFullYear()} Permanent Thematic Watchlist
      </span>

      <div className="wl-social">
        <a
          className="wl-social-link"
          href={linkedin}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="LinkedIn"
          title="LinkedIn"
        >
          <IconLinkedIn className="wl-social-ico" />
          <span>LinkedIn</span>
        </a>

        <a
          className="wl-social-link"
          href={twitter}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Twitter/X"
          title="Twitter/X"
        >
          <IconX className="wl-social-ico" />
          <span>Twitter</span>
        </a>
      </div>
    </footer>
  );
}

function IconLinkedIn(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM14.5 9c-2.21 0-3.5 1.214-3.5 3.142V21h4v-6.6c0-1.096.77-1.9 1.82-1.9 1.02 0 1.68.678 1.68 1.9V21h4v-7.4C22.5 10.83 20.9 9 18.24 9c-1.23 0-2.37.49-3.12 1.28V9h-.62z"
      />
    </svg>
  );
}

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M18.9 3H22l-7.02 8.03L22.6 21h-6.5l-4.1-5.2L6.6 21H2l7.49-8.56L1.8 3h6.6l3.67 4.82L18.9 3zm-2.27 16h1.49L7.47 5H5.97l10.66 14z"
      />
    </svg>
  );
}
