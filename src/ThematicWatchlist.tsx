import React, { useMemo, useState, useEffect } from "react";

/* ---------- Types ---------- */
export type WatchItem = {
  Ticker: string;
  Company: string;
  "Theme(s)": string;
  "Thesis Snapshot": string;
  "Key 2026 Catalysts": string;
  "What Moves It (Triggers)": string;
  "Catalyst Path"?: string;
  Notes: string;
};

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
  const [sort, setSort] = useState<{ key: keyof WatchItem; dir: "asc" | "desc" } | null>({
    key: "Ticker", dir: "asc",
  });

  /* ---------- Load CSV ---------- */
  useEffect(() => {
    (async () => {
      const Papa = (await import("papaparse")).default;
      const res = await fetch(csvUrl, { cache: "no-cache" });
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rs = (parsed.data as any[]).map((r) => ({
        Ticker: r.Ticker?.trim() ?? "",
        Company: r.Company?.trim() ?? "",
        "Theme(s)": r["Theme(s)"]?.trim() ?? "",
        "Thesis Snapshot": r["Thesis Snapshot"]?.trim() ?? "",
        "Key 2026 Catalysts": r["Key 2026 Catalysts"]?.trim() ?? "",
        "What Moves It (Triggers)": r["What Moves It (Triggers)"]?.trim() ?? "",
        "Catalyst Path": r["Catalyst Path"]?.trim() ?? "",
        Notes: r.Notes?.trim() ?? "",
      })) as WatchItem[];
      setRows(rs);
    })().catch(console.error);
  }, [csvUrl]);

  /* ---------- Helpers ---------- */
  const splitThemes = (s: string) => s.split(/[,|]/).map((x) => x.trim()).filter(Boolean);

  const allThemes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => splitThemes(r["Theme(s)"])))).sort(),
    [rows]
  );

  const isAllSelected = allThemes.length > 0 && themesSelected.length === allThemes.length;

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (themesSelected.length === 0) return []; // empty table when none selected

    let data = rows.filter((r) => {
      const matchesTheme = splitThemes(r["Theme(s)"]).some((t) => themesSelected.includes(t));
      if (!matchesTheme) return false;
      const matchesQ =
        !needle ||
        [
          r.Ticker, r.Company, r["Theme(s)"], r["Thesis Snapshot"],
          r["Key 2026 Catalysts"], r["What Moves It (Triggers)"],
          r["Catalyst Path"] ?? "", r.Notes,
        ].join(" ").toLowerCase().includes(needle);
      return matchesQ;
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
      setCurrentTheme(t); // latest = current (blue)
    }
  };

  const clearThemes = () => { setThemesSelected([]); setCurrentTheme(null); };

  const toggleAllThemes = () => {
    if (isAllSelected) {
      // Clicking again clears everything
      setThemesSelected([]);
      setCurrentTheme(null);
    } else {
      // Select all; keep currentTheme null so none is blue until user chooses one
      setThemesSelected(allThemes);
      setCurrentTheme(null);
      // If you want one to be blue by default, set: setCurrentTheme(allThemes[0]);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Title & Search */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-xs text-slate-400">
              Current theme = <span className="text-blue-300">blue</span>; previously selected = <span className="text-white">white</span>.
              “All themes” toggles select-all ↔ none.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search within selected themes…"
              className="w-80 max-w-[70vw] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-white/20"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Theme pills */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* All themes button */}
          <button
            onClick={toggleAllThemes}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              isAllSelected
                ? "bg-blue-500 text-white border-blue-400 hover:bg-blue-500"
                : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
            }`}
            title={isAllSelected ? "Deselect all themes" : "Select all themes"}
          >
            All themes
          </button>

          {/* Individual themes */}
          {allThemes.map((t) => {
            const isSelected = themesSelected.includes(t);
            const isCurrent  = isSelected && currentTheme === t;

            // CURRENT = blue; PREVIOUS = outlined white; UNSELECTED = gray
            const cls = isSelected
              ? (isCurrent
                  ? "bg-blue-500 text-white border-blue-400 hover:bg-blue-500"
                  : "bg-transparent text-white border-white ring-1 ring-white/80 hover:bg-white/5")
              : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10";

            return (
              <button
                key={t}
                onClick={() => toggleTheme(t)}
                className={`rounded-full px-3 py-1 text-xs transition border ${cls}`}
                title={isSelected ? "Click to deselect" : "Click to select"}
              >
                {t}
              </button>
            );
          })}

          {/* Clear themes = clear selection AND clear table */}
          <button
            onClick={clearThemes}
            className="text-xs text-rose-200/90 underline underline-offset-4"
            title="Clear all selected themes (table will be empty)"
          >
            Clear themes
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-neutral-900/85 backdrop-blur">
                  {th("Ticker", "Ticker", "w-[110px] sticky left-0 z-30")}
                  {th("Company", "Company", "min-w-[220px]")}
                  {th("Theme(s)", "Theme(s)", "min-w-[260px]")}
                  {th("Thesis Snapshot", "Thesis", "min-w-[420px]")}
                  {th("Key 2026 Catalysts", "2026 Catalysts", "min-w-[360px]")}
                  {th("What Moves It (Triggers)", "What Moves It", "min-w-[360px]")}
                  {th("Catalyst Path", "Catalyst Path", "min-w-[320px]")}
                  {th("Notes", "Notes", "min-w-[240px]")}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const zebra = i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent";
                  return (
                    <tr key={`${r.Ticker}-${i}`} className={`${zebra} hover:bg-white/[0.06] transition-colors`}>
                      <td className="sticky left-0 z-20 border-b border-white/10 px-3 py-2 align-top bg-neutral-950/60 backdrop-blur" title={r.Ticker}>
                        <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tracking-wide">
                          {r.Ticker || "—"}
                        </span>
                      </td>
                      <Cell value={r.Company} />
                      <Cell value={r["Theme(s)"]} raw={r["Theme(s)"]} />
                      <Cell value={r["Thesis Snapshot"]} long />
                      <Cell value={r["Key 2026 Catalysts"]} long />
                      <Cell value={r["What Moves It (Triggers)"]} long />
                      <Cell value={r["Catalyst Path"] ?? ""} long />
                      <Cell value={r.Notes} long />
                    </tr>
                  );
                })}

                {themesSelected.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center text-slate-400">
                      No themes selected. Pick one above to populate the table.
                    </td>
                  </tr>
                )}

                {themesSelected.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center text-slate-400">
                      No results within the selected theme(s). Try clearing the search box.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count */}
        <div className="mt-3 text-xs text-slate-400">
          {themesSelected.length === 0
            ? <>No themes selected</>
            : <>Showing <span className="text-slate-200">{filtered.length}</span> item{filtered.length === 1 ? "" : "s"}</>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Small helpers ---------- */

function th(key: keyof WatchItem, label?: string, width?: string) {
  return (
    <th className={`px-3 py-2 font-semibold text-slate-200 text-xs lg:text-sm ${width ?? ""}`}>
      <span className="flex items-center gap-1">{label ?? String(key)}</span>
    </th>
  );
}

function Cell({ value, raw, long }: { value: React.ReactNode | string; raw?: string; long?: boolean }) {
  return (
    <td className="border-b border-white/10 px-3 py-2 align-top" title={typeof value === "string" ? value : raw}>
      <div className={`text-[13px] leading-[1.35] ${long ? "max-w-[720px]" : "max-w-[340px]"} truncate sm:whitespace-normal sm:line-clamp-3`}>
        {value || "—"}
      </div>
    </td>
  );
}
