import { useMemo, useState } from "react";
import { WatchItem, SortState } from "../utils/types"
import { computeThemesForDates, splitThemes, sortRows } from "../utils/filters";

export function useSelectionState(rows: WatchItem[], allThemes: string[], themesByDate: Map<string, Set<string>>) {
  const [q, setQ] = useState("");
  const [themesSelected, setThemesSelected] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "Ticker", dir: "asc" });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const isAllSelected = allThemes.length > 0 && themesSelected.length === allThemes.length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (themesSelected.length === 0) return [];
    let data = rows.filter(r => {
      const matchesTheme = splitThemes(r["Theme(s)"]).some(t => themesSelected.includes(t));
      if (!matchesTheme) return false;
      if (!needle) return true;
      const blob = [
        r.Ticker, r.Company, r["Theme(s)"], r["Thesis Snapshot"], r["Key 2026 Catalysts"],
        r["What Moves It (Triggers)"], r["Catalyst Path"] ?? "", r.Notes ?? "", r["Date analyzed"] ?? "",
      ].join(" ").toLowerCase();
      return blob.includes(needle);
    });
    return sortRows(data, sort);
  }, [rows, q, themesSelected, sort]);

  // actions
  const clickSort = (key: keyof WatchItem) => {
    setSort(prev => (prev && prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const toggleTheme = (t: string) => {
    if (selectedDates.size > 0) {
      const isActive = themesSelected.includes(t);
      const next = isActive ? themesSelected.filter(x => x !== t) : [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(isActive ? (next.length ? next[next.length - 1] : null) : t);
      return;
    }
    const isActive = themesSelected.includes(t);
    if (isActive) {
      const next = themesSelected.filter(x => x !== t);
      setThemesSelected(next);
      if (currentTheme === t) setCurrentTheme(next.length ? next[next.length - 1] : null);
    } else {
      const next = [...themesSelected, t];
      setThemesSelected(next);
      setCurrentTheme(t);
    }
  };

  const clearThemes = () => { setThemesSelected([]); setCurrentTheme(null); };

  const toggleAllThemes = () => {
    if (isAllSelected) { setThemesSelected([]); setCurrentTheme(null); }
    else { setThemesSelected(allThemes); setCurrentTheme(null); }
  };

  const applyDatesToThemes = (dates: Set<string>) => {
    const nextThemes = computeThemesForDates(dates, themesByDate);
    setThemesSelected(nextThemes);
    setCurrentTheme(null);
  };

  const toggleDate = (d: string) => {
    const next = new Set(selectedDates);
    if (next.has(d)) next.delete(d); else next.add(d);
    setSelectedDates(next);
    applyDatesToThemes(next);
  };

  const clearDates = () => {
    setSelectedDates(new Set());
    setThemesSelected([]);
    setCurrentTheme(null);
  };

  return {
    // state
    q, themesSelected, currentTheme, sort, selectedDates, isAllSelected, filtered,
    // setters/actions
    setQ, clickSort, toggleTheme, clearThemes, toggleAllThemes, toggleDate, clearDates,
  };
}
