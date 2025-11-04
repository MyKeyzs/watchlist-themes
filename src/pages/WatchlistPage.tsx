// src/pages/WatchlistPage.tsx
import React from "react";

import SearchBox from "../components/SearchBox/SearchBox";
import DateFilter from "../components/DateFilter/DateFilter";
import ThemeChips from "../components/ThemeChips/ThemeChips";
import WatchTable from "../components/WatchTable/WatchTable";
import FooterBar from "../components/FooterBar/FooterBar";
import type { SortState } from "../components/WatchTable/WatchTable"; 
import { useWatchlistData } from "../hooks/useWatchlistData";
import { useSelectionState } from "../hooks/useSelectionState";

type Props = {
  csvUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  title?: string;
};

export default function WatchlistPage({
  csvUrl = "/permanent_thematic_watchlist_2026_merged_from_excel.csv",
  linkedinUrl = "https://www.linkedin.com/in/YOUR_HANDLE",
  twitterUrl = "https://twitter.com/YOUR_HANDLE",
  title = "Permanent Thematic Watchlist",
}: Props) {
  // Load & normalize CSV
  const { rows, loading, error, allThemes, uniqueDates, themesByDate } =
    useWatchlistData(csvUrl);

  // UI state: search, selected themes, selected dates, sorting, etc.
  const sel = useSelectionState(rows, allThemes, themesByDate);
  const { filtered } = sel;

  // inside WatchlistPage component, before the return()
const handleTableSort = (s: SortState) => {
  // your hook toggles sort based on the column key, so forward just the key
  sel.clickSort(s.key as any); // if your clickSort already accepts SortKey, remove "as any"
};

  return (
    <div className="wl-root">
      <div className="wl-container">
        {/* Header */}
        <div className="wl-toolbar">
          <div>
            <h1 className="wl-title">{title}</h1>
            <p className="wl-subtitle">
              Current theme = <span className="wl-k-blue">blue</span>; latest
              selection = <span className="wl-k-green">green</span>. “All
              themes” toggles select-all → none.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {/* Date filter (no selectedCount/extra props to avoid TS errors) */}
            <DateFilter
              uniqueDates={uniqueDates}
              selectedDates={sel.selectedDates}
              onToggleDate={sel.toggleDate}
              onClearDates={sel.clearDates}
            />

            {/* Search (no placeholder prop; component accepts value/onChange/onClear) */}
            <SearchBox
              value={sel.q}
              onChange={sel.setQ}
              onClear={() => sel.setQ("")}
            />
          </div>
        </div>

        {/* Theme chips */}
        <ThemeChips
          allThemes={allThemes}
          themesSelected={sel.themesSelected}
          currentTheme={sel.currentTheme}
          isAllSelected={sel.isAllSelected}
          onToggleTheme={sel.toggleTheme}
          onClearThemes={sel.clearThemes}
          onToggleAll={sel.toggleAllThemes}
        />

        {/* Loading / Error states */}
        {loading && <div className="wl-empty">Loading…</div>}
        {error && !loading && <div className="wl-empty">Error: {error}</div>}

        {/* Table */}
        {!loading && !error && (
          <>
            <WatchTable rows={filtered} sort={sel.sort} onSort={handleTableSort} />
            <div className="wl-count">
              {sel.themesSelected.length === 0
                ? "No themes selected"
                : `Showing ${filtered.length} item${
                    filtered.length === 1 ? "" : "s"
                  }`}
            </div>
          </>
        )}

        {/* Footer */}
        <FooterBar linkedin={linkedinUrl} twitter={twitterUrl} />
      </div>
    </div>
  );
}
