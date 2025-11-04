import React, { useEffect, useMemo, useState } from "react";

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
  "Date analyzed"?: string;
};

type SortState = { key: keyof WatchItem; dir: "asc" | "desc" } | null;

export default function ThematicWatchlist({
  title = "Permanent Thematic Watchlist",
  csvUrl = "/permanent_thematic_watchlist_2026_merged_from_excel.csv",
  linkedinUrl = "https://www.linkedin.com/in/YOUR_HANDLE",
  twitterUrl = "https://twitter.com/YOUR_HANDLE",
}: {
  title?: string;
  csvUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
}) {
  /* ---------- State ---------- */
  const [rows, setRows] = useState<WatchItem[]>([]);
  const [q, setQ] = useState("");
  const [themesSelected, setThemesSelected] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "Ticker", dir: "asc" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

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
        "What Moves It (Triggers)": (r["What Moves It (Triggers)"] ?? "").trim(),
        "Catalyst Path": (r["Catalyst Path"] ?? "").trim(),
        Notes: (r.Notes ?? "").trim(),
        "Date analyzed": (r["Date analyzed"] ?? "").trim(),
      })) as WatchItem[];

      setRows(rs);
    })().catch(console.error);
  }, [csvUrl]);

  /* ---------- Helpers ---------- */
  const splitThemes = (s: string) =>
    s
      .split(/[,|]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );

  const uniqueDates = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => (r["Date analyzed"] || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => {
        // Sort by MM/DD-ish strings like "10/29" (desc)
        const toNum = (d: string) => {
          const m = d.match(/^(\d{1,2})[\/\-](\d{1,2})/);
          if (!m) return Number.MAX_SAFE_INTEGER;
          return Number(m[1]) * 100 + Number(m[2]);
        };
        return toNum(b) - toNum(a);
      }),
    [rows]
  );

  // date -> set(themes) map
  const themesByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const d = (r["Date analyzed"] || "").trim();
      if (!d) continue;
      const set = map.get(d) ?? new Set<string>();
      for (const t of splitThemes(r["Theme(s)"])) set.add(t);
      map.set(d, set);
    }
    return map;
  }, [rows]);

  const isAllSelected = allThemes.length > 0 && themesSelected.length === allThemes.length;
  const activeDateCount = selectedDates.size;

  /* ---------- Theme + Date Selection (UPDATED) ---------- */

  /** Build the exact theme set implied by the selected dates */
  function computeThemesForDates(
    dates: Set<string>,
    themesByDate: Map<string, Set<string>>
  ): string[] {
    const out = new Set<string>();
    for (const d of dates) {
      const set = themesByDate.get(d);
      if (set) for (const t of set) out.add(t);
    }
    return Array.from(out);
  }

  /** Recompute theme chips strictly from dates */
  const applyDatesToThemes = (dates: Set<string>) => {
    const nextThemes = computeThemesForDates(dates, themesByDate);
    setThemesSelected(nextThemes);
    setCurrentTheme(null);
  };

  const toggleTheme = (t: string) => {
    // If dates are selected, themes mirror dates. We still allow manual chip toggles,
    // but any date change will recompute from dates again.
    if (selectedDates.size > 0) {
      const isActive = themesSelected.includes(t);
      const next = isActive
        ? themesSelected.filter((x) => x !== t)
        : [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(isActive ? (next.length ? next[next.length - 1] : null) : t);
      return;
    }

    // Manual mode (no dates chosen)
    const isActive = themesSelected.includes(t);
    if (isActive) {
      const next = themesSelected.filter((x) => x !== t);
      setThemesSelected(next);
      if (currentTheme === t)
        setCurrentTheme(next.length ? next[next.length - 1] : null);
    } else {
      const next = [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(t);
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

  const toggleDate = (d: string) => {
    const next = new Set(selectedDates);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setSelectedDates(next);
    applyDatesToThemes(next); // <- recompute exact theme set per current dates
  };

  const clearDates = () => {
    setSelectedDates(new Set());
    setThemesSelected([]);     // <- fully deselect theme chips
    setCurrentTheme(null);
  };

  /* ---------- Filtering & Sorting ---------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (themesSelected.length === 0) return []; // empty table when none selected

    let data = rows.filter((r) => {
      const matchesTheme = splitThemes(r["Theme(s)"]).some((t) => themesSelected.includes(t));
      if (!matchesTheme) return false;

      if (!needle) return true;
      const blob = [
        r.Ticker, r.Company, r["Theme(s)"], r["Thesis Snapshot"], r["Key 2026 Catalysts"],
        r["What Moves It (Triggers)"], r["Catalyst Path"] ?? "", r.Notes ?? "", r["Date analyzed"] ?? "",
      ].join(" ").toLowerCase();
      return blob.includes(needle);
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

  const clickSort = (key: keyof WatchItem) => {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  /* ---------- UI ---------- */
  return (
    <div className="wl-root">
      <div className="wl-container">
        {/* Title & Search / Filters */}
        <div className="wl-toolbar">
          <div>
            <h1 className="wl-title">{title}</h1>
            <p className="wl-subtitle">
              Current theme = <span className="wl-k-blue">blue</span>; latest selection ={" "}
              <span className="wl-k-green">green</span>. “All themes” toggles select-all ↔ none.
            </p>
          </div>

          <div className="wl-filter-group">
            {/* Date filter menu */}
            <div className="wl-datefilter">
              <button
                className="wl-btn wl-btn--menu"
                onClick={() => setMenuOpen((s) => !s)}
                aria-expanded={menuOpen}
              >
                <span className="wl-btn-ico" aria-hidden>📅</span>
                Filter by date
                {activeDateCount > 0 && <span className="wl-badge">{activeDateCount}</span>}
              </button>

              {menuOpen && (
                <div className="wl-menu" role="menu">
                  <div className="wl-menu-head">
                    <span>DATE ANALYZED</span>
                    <button className="wl-menu-clear" onClick={clearDates}>
                      Clear dates
                    </button>
                  </div>

                  <div className="wl-menu-body custom-scroll">
                    <ul className="wl-menu-list">
                      {uniqueDates.length === 0 && (
                        <li className="wl-menu-empty">No dates available</li>
                      )}
                      {uniqueDates.map((d) => (
                        <li key={d}>
                          <button
                            className={`wl-menu-item ${selectedDates.has(d) ? "wl-menu-item--on" : ""}`}
                            onClick={() => toggleDate(d)}
                          >
                            <span className="wl-menu-check">
                              {selectedDates.has(d) ? "✓" : ""}
                            </span>
                            {d}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
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
        </div>

        {/* Theme chips: All + rows */}
        <div className="wl-themes-outer">
          <div className="wl-chip-row">
            <button
              className="wl-pill wl-pill--all"
              onClick={toggleAllThemes}
              title={isAllSelected ? "Deselect all themes" : "Select all themes"}
            >
              All themes
            </button>

            <button className="wl-clear" onClick={clearThemes}>
              Clear themes
            </button>
          </div>

          <div className="wl-themes">
            <div className="wl-chip-row">
              {allThemes.map((t) => {
                const isSelected = themesSelected.includes(t);
                const isCurrent = isSelected && currentTheme === t;
                const className = isSelected
                  ? isCurrent
                    ? "wl-pill wl-pill--current"
                    : "wl-pill wl-pill--prev"
                  : "wl-pill wl-pill--idle";
                return (
                  <button
                    key={t}
                    className={className}
                    onClick={() => toggleTheme(t)}
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
                  {TH("Ticker", "Ticker", () => clickSort("Ticker"), sort)}
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
                      <td className="wl-ticker-cell">
                        <button
                          className="wl-ticker-chip"
                          onClick={() =>
                            window.open(
                              `https://www.tradingview.com/chart/WiBJEuAh/?symbol=${encodeURIComponent(
                                r.Ticker
                              )}`,
                              "_blank"
                            )
                          }
                          title="Open in TradingView"
                        >
                          {r.Ticker || "—"}
                        </button>
                      </td>
                      <Cell value={r.Company} />
                      <Cell value={r["Theme(s)"]} raw={r["Theme(s)"]} />
                      <Cell value={r["Date analyzed"] || ""} />
                      <Cell value={r["Thesis Snapshot"]} long />
                      <Cell value={r["Key 2026 Catalysts"]} long />
                      <Cell value={r["What Moves It (Triggers)"]} long />
                      <Cell value={r["Catalyst Path"] ?? ""} long />
                      <Cell value={r.Notes ?? ""} long />
                    </tr>
                  );
                })}

                {themesSelected.length === 0 && (
                  <tr>
                    <td className="wl-empty" colSpan={9}>
                      No themes selected. Pick one above to populate the table.
                    </td>
                  </tr>
                )}

                {themesSelected.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td className="wl-empty" colSpan={9}>
                      No results within the selected theme(s). Try clearing the search box.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count + Footer */}
        <div className="wl-count">
          {themesSelected.length === 0 ? (
            <>No themes selected</>
          ) : (
            <>
              Showing <span className="wl-count-num">{filtered.length}</span>{" "}
              item{filtered.length === 1 ? "" : "s"}
            </>
          )}
        </div>

        <footer className="wl-footer">
          <span className="wl-footer-copy">
            © {new Date().getFullYear()} Permanent Thematic Watchlist
          </span>
          <ul className="wl-social">
            <li>
              <a className="wl-social-link" href={linkedinUrl} target="_blank" rel="noreferrer">
                <span className="wl-social-ico">in</span> LinkedIn
              </a>
            </li>
            <li>
              <a className="wl-social-link" href={twitterUrl} target="_blank" rel="noreferrer">
                <span className="wl-social-ico">𝕏</span> X (Twitter)
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  );
}

/* ---------- Small helpers ---------- */

function TH(
  key: keyof WatchItem,
  label: string,
  onClick: () => void,
  sort: SortState
) {
  const isActive = sort?.key === key;
  return (
    <th className="wl-th">
      <button className="wl-th-btn" onClick={onClick}>
        <span>{label}</span>
        <span className={`wl-th-caret ${isActive ? "wl-th-caret--on" : ""}`}>
          {isActive ? (sort!.dir === "asc" ? "▲" : "▼") : "▾"}
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
