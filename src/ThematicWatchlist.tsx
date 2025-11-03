import React, { useMemo, useState, useEffect } from "react";

// ---------- Types ----------
export type WatchItem = {
  Ticker: string;
  Company: string;
  "Theme(s)": string;
  "Thesis Snapshot": string;
  "Key 2026 Catalysts": string;
  "What Moves It (Triggers)": string;
  Notes: string;
};

export type WatchlistProps = {
  data?: WatchItem[];           // Optional: pass programmatic data
  title?: string;
  csvUrl?: string;              // e.g., "/permanent_thematic_watchlist_2026.csv"
  wsUrl?: string;               // e.g., "ws://localhost:8787"
};

// ---------- Utils ----------
const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");
const dedupe = (arr: string[]) => Array.from(new Set(arr));
const themeSplit = (s: string) => s.split(/[,|]/).map(t => t.trim()).filter(Boolean);

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState] as const;
}

const Badge: React.FC<{ children: React.ReactNode; tone?: "blue"|"green"|"amber"|"rose"|"slate" }>
= ({ children, tone = "slate" }) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
    tone === "blue" && "bg-blue-50/10 border-blue-400/30 text-blue-200",
    tone === "green" && "bg-green-50/10 border-green-400/30 text-green-200",
    tone === "amber" && "bg-amber-50/10 border-amber-400/30 text-amber-200",
    tone === "rose" && "bg-rose-50/10 border-rose-400/30 text-rose-200",
    tone === "slate" && "bg-slate-50/10 border-slate-400/30 text-slate-200",
  )}>{children}</span>
);

const Pill: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {active?: boolean}>
= ({active, className, children, ...props}) => (
  <button {...props}
    className={cn(
      "rounded-full border px-3 py-1 text-sm transition",
      active ? "bg-white/10 border-white/30 text-white" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10",
      className
    )}
  >{children}</button>
);

const densityClasses = { comfy: "text-sm", cozy: "text-xs", compact: "text-[11px]" } as const;
type Density = keyof typeof densityClasses;
type SortKey = keyof WatchItem;
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

// ---------- Live Catalyst Bar (singleton + dedupe) ----------
type CatalystMsg = { id?: string; ticker: string; label: string; severity?: "info"|"success"|"warn"|"error"; url?: string; ts?: number };

declare global {
  interface Window { __twlSocket?: WebSocket; __twlReconnect?: number | undefined; }
}

function LiveCatalystBar({ wsUrl }: { wsUrl?: string }) {
  const [events, setEvents] = useState<{ id: string; msg: CatalystMsg }[]>([]);
  const seenRef = React.useRef<Map<string, number>>(new Map()); // (ticker|label) -> last ts
  const MAX_KEEP_MS = 2 * 60 * 1000;
  const MAX_ITEMS = 30;

  const isDuplicate = (m: CatalystMsg) => {
    const key = `${m.ticker}|${m.label}`;
    const now = m.ts ?? Date.now();
    const last = seenRef.current.get(key) ?? 0;
    if (now - last < 45_000) return true; // ignore repeats within 45s
    seenRef.current.set(key, now);
    // GC
    for (const [k, t] of seenRef.current) if (now - t > MAX_KEEP_MS) seenRef.current.delete(k);
    return false;
  };

  useEffect(() => {
    if (!wsUrl) return;

    // Avoid multiple sockets in dev HMR
    if (window.__twlSocket && window.__twlSocket.readyState <= 1) return;

    let socket: WebSocket | null = null;

    const connect = () => {
      if (window.__twlReconnect) { clearTimeout(window.__twlReconnect); window.__twlReconnect = undefined; }

      socket = new WebSocket(wsUrl);
      window.__twlSocket = socket;

      socket.onmessage = (ev) => {
        try {
          const raw = JSON.parse(ev.data) as CatalystMsg;
          const id = raw.id ?? `${raw.ticker}-${raw.label}-${raw.ts ?? Date.now()}`;
          if (isDuplicate(raw)) return;

          const now = Date.now();
          setEvents(prev => {
            const fresh = prev.filter(e => now - (e.msg.ts ?? now) < MAX_KEEP_MS);
            return [{ id, msg: raw }, ...fresh].slice(0, MAX_ITEMS);
          });
        } catch {}
      };

      socket.onclose = () => {
        window.__twlSocket = undefined;
        window.__twlReconnect = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      if (window.__twlReconnect) { clearTimeout(window.__twlReconnect); window.__twlReconnect = undefined; }
      if (window.__twlSocket && window.__twlSocket.readyState <= 1) window.__twlSocket.close();
      window.__twlSocket = undefined;
    };
  }, [wsUrl]);

  if (!wsUrl) return null;
  return (
    <div className="mt-4 space-y-2">
      {events.map(({ id, msg }) => (
        <div key={id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={`
              inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border
              ${msg.severity === "success" ? "bg-green-50/10 border-green-400/30 text-green-200" :
                 msg.severity === "warn"    ? "bg-amber-50/10 border-amber-400/30 text-amber-200" :
                 msg.severity === "error"   ? "bg-rose-50/10 border-rose-400/30 text-rose-200" :
                                               "bg-blue-50/10 border-blue-400/30 text-blue-200"}`}>
              {msg.label}
            </span>
            <span className="font-semibold">{msg.ticker}</span>
            {msg.url && <a href={msg.url} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">source</a>}
            <span className="ml-auto text-xs text-slate-400">{new Date(msg.ts ?? Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Main Component ----------
export default function ThematicWatchlist({ data: propData, title = "Thematic Watchlist", csvUrl, wsUrl }: WatchlistProps) {
  const [query, setQuery] = useLocalStorage("twl_query", "");
  const [density, setDensity] = useLocalStorage<Density>("twl_density", "cozy");
  const [page, setPage] = useLocalStorage("twl_page", 1);
  const [rowsPerPage, setRpp] = useLocalStorage("twl_rpp", 15);
  const [sort, setSort] = useLocalStorage<Sort>("twl_sort", { key: "Ticker", dir: "asc" });
  const [selectedThemes, setSelectedThemes] = useLocalStorage<string[]>("twl_themes", []);

  // CSV loading
  const [csvData, setCsvData] = useState<WatchItem[] | null>(null);
  useEffect(() => {
    if (!csvUrl) return;
    (async () => {
      try {
        const Papa = (await import("papaparse")).default;
        const res = await fetch(csvUrl);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = (parsed.data as any[]).map((r) => ({
          Ticker: r.Ticker?.trim() ?? "",
          Company: r.Company?.trim() ?? "",
          "Theme(s)": r["Theme(s)"]?.trim() ?? "",
          "Thesis Snapshot": r["Thesis Snapshot"]?.trim() ?? "",
          "Key 2026 Catalysts": r["Key 2026 Catalysts"]?.trim() ?? "",
          "What Moves It (Triggers)": r["What Moves It (Triggers)"]?.trim() ?? "",
          Notes: r.Notes?.trim() ?? "",
        })) as WatchItem[];
        setCsvData(rows);
      } catch (e) {
        console.error("CSV load failed", e);
        setCsvData(null);
      }
    })();
  }, [csvUrl]);

  const data = propData ?? csvData ?? [];

  // Themes list
  const themes = useMemo(() => dedupe(data.flatMap(d => themeSplit(d["Theme(s)"])) ).sort(), [data]);

  // Filter/sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = data.filter(row => {
      const matchesQuery = !q || [row.Ticker, row.Company, row["Thesis Snapshot"], row["Key 2026 Catalysts"], row["What Moves It (Triggers)"], row["Theme(s)"]]
        .some(v => (v ?? "").toLowerCase().includes(q));
      const matchesThemes = selectedThemes.length === 0 || themeSplit(row["Theme(s)"]).some(t => selectedThemes.includes(t));
      return matchesQuery && matchesThemes;
    });
    if (sort) {
      base = base.slice().sort((a, b) => {
        const av = String(a[sort.key] ?? "").toLowerCase();
        const bv = String(b[sort.key] ?? "").toLowerCase();
        if (av < bv) return sort.dir === "asc" ? -1 : 1;
        if (av > bv) return sort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return base;
  }, [data, query, selectedThemes, sort]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const setSortKey = (key: SortKey) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]) as (keyof WatchItem)[];
    const rows = filtered.map(r => headers.map(h => `"${String(r[h]).replaceAll('"','""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `thematic_watchlist_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">Search, filter by theme, sort columns, export CSV, and see live catalysts.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1">
              {(["comfy","cozy","compact"] as Density[]).map(d => (
                <Pill key={d} active={d===density} onClick={() => setDensity(d)}>{d}</Pill>
              ))}
            </div>
            <Pill onClick={exportCSV}>Export CSV</Pill>
          </div>
        </header>

        {/* CSV file picker (fallback) */}
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="file"
            accept=".csv"
            onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const Papa = (await import("papaparse")).default;
              const text = await file.text();
              const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
              const rows = (parsed.data as any[]).map((r) => ({
                Ticker: r.Ticker?.trim() ?? "",
                Company: r.Company?.trim() ?? "",
                "Theme(s)": r["Theme(s)"]?.trim() ?? "",
                "Thesis Snapshot": r["Thesis Snapshot"]?.trim() ?? "",
                "Key 2026 Catalysts": r["Key 2026 Catalysts"]?.trim() ?? "",
                "What Moves It (Triggers)": r["What Moves It (Triggers)"]?.trim() ?? "",
                Notes: r.Notes?.trim() ?? "",
              })) as WatchItem[];
              setCsvData(rows);
              setPage(1);
            }}
          />
          <span className="text-slate-500">or set <code>csvUrl</code> to auto-load from <code>/permanent_thematic_watchlist_2026.csv</code></span>
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search ticker, company, thesis…"
                className="w-80 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-white/20"
              />
              {query && (
                <button onClick={() => { setQuery(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">✕</button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {themes.map(t => {
              const selected = selectedThemes.includes(t);
              return (
                <button key={t}
                  onClick={() => {
                    const next = selected ? selectedThemes.filter(x => x!==t) : [...selectedThemes, t];
                    setSelectedThemes(next); setPage(1);
                  }}
                  className={cn("rounded-full border px-3 py-1 text-xs",
                    selected ? "bg-white text-neutral-900 border-white" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
                  )}>
                  {t}
                </button>
              );
            })}
            {selectedThemes.length > 0 && (
              <button onClick={() => { setSelectedThemes([]); setPage(1); }}
                className="text-xs text-slate-300 underline underline-offset-4">
                Clear themes
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur", densityClasses[density])}>
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur">
                <tr className="text-left text-slate-300">
                  {([
                    { key: "Ticker", w: "w-[90px]" },
                    { key: "Company", w: "w-[220px]" },
                    { key: "Theme(s)", w: "w-[320px]" },
                    { key: "Thesis Snapshot", w: "w-[520px]" },
                    { key: "Key 2026 Catalysts", w: "w-[420px]" },
                    { key: "What Moves It (Triggers)", w: "w-[420px]" },
                    { key: "Notes", w: "w-[280px]" },
                  ] as {key: SortKey; w: string}[]).map(({key, w}) => (
                    <th key={key as string} className={cn("sticky top-0 border-b border-white/10 px-3 py-2 font-medium", w)}>
                      <button onClick={() => setSortKey(key)} className="flex items-center gap-1">
                        <span>{key}</span>
                        {sort?.key === key && <span className="text-xs text-slate-400">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  const rowId = `${row.Ticker}-${idx}`;
                  const themes = themeSplit(row["Theme(s)"]);
                  return (
                    <tr key={rowId} className="border-b border-white/5 hover:bg-white/5 align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tracking-wide">{row.Ticker}</span>
                        </div>
                        <div className="mt-1"><Badge tone="blue">{themes[0] ?? ""}</Badge></div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.Company}</div>
                        {themes.length > 1 && (
                          <div className="mt-1 flex flex-wrap gap-1">{themes.slice(1).map(t => <Badge key={t} tone="slate">{t}</Badge>)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{row["Theme(s)"]}</td>
                      <td className="px-3 py-2 text-slate-200">{row["Thesis Snapshot"]}</td>
                      <td className="px-3 py-2 text-slate-200">{row["Key 2026 Catalysts"]}</td>
                      <td className="px-3 py-2 text-slate-200">{row["What Moves It (Triggers)"]}</td>
                      <td className="px-3 py-2 text-slate-200">{row.Notes}</td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">No results. Load a CSV or adjust filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs text-slate-300">
            <div>
              Showing <span className="text-slate-100">{Math.min(filtered.length, (page-1)*rowsPerPage + 1)}</span>–
              <span className="text-slate-100">{Math.min(filtered.length, page*rowsPerPage)}</span> of <span className="text-slate-100">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={rowsPerPage} onChange={e => { setRpp(parseInt(e.target.value)); setPage(1); }} className="rounded-lg bg-white/5 px-2 py-1">
                {[10,15,25,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <div className="flex items-center gap-1">
                <Pill onClick={() => setPage(1)} disabled={page===1}>«</Pill>
                <Pill onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>‹</Pill>
                <span className="mx-1">Page {page} / {pageCount}</span>
                <Pill onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={page===pageCount}>›</Pill>
                <Pill onClick={() => setPage(pageCount)} disabled={page===pageCount}>»</Pill>
              </div>
            </div>
          </div>
        </div>

        {/* Live catalysts */}
        <LiveCatalystBar wsUrl={wsUrl} />

        <footer className="mt-6 text-center text-xs text-slate-500">
          Tip: Click headers to sort (asc → desc → clear). Use file picker to swap CSV on the fly.
        </footer>
      </div>
    </div>
  );
}
