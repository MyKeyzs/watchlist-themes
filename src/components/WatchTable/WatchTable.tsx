
import React from "react";
import { WatchItem } from "../../utils/types";

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
  | "Initial Price";

export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

type Props = {
  rows: WatchItem[];
  sort: SortState;
  /** Preferred prop name */
  setSort?: (s: SortState) => void;
  /** Back-compat prop name */
  onSort?: (s: SortState) => void;
};

function Caret({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={
        "ml-1 inline-block text-[10px] transition-opacity " +
        (active ? "opacity-100 text-white" : "opacity-40 text-white")
      }
      aria-hidden
    >
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function TH({
  label,
  sortKey,
  sort,
  applySort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  applySort: (s: SortState) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const onClick = () =>
    applySort({
      key: sortKey,
      dir: active ? (sort.dir === "asc" ? "desc" : "asc") : "asc",
    });

  return (
    <th className={`wl-th ${className ?? ""}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-white">
        <span>{label}</span>
        <Caret active={active} dir={active ? sort.dir : "asc"} />
      </button>
    </th>
  );
}

function Cell({
  value,
  title,
  long,
  className,
}: {
  value: React.ReactNode;
  title?: string;
  long?: boolean;
  className?: string;
}) {
  return (
    <td className={`wl-td ${className ?? ""}`} title={title}>
      <div className={(long ? "wl-td-long" : "wl-td-short") + " sm:whitespace-normal sm:line-clamp-3"}>
        {value || "—"}
      </div>
    </td>
  );
}

export default function WatchTable({ rows, sort, setSort, onSort }: Props) {
  // Accept either prop name (prevents “setSort missing” error)
  const applySort = setSort ?? onSort ?? (() => {});

  const sorted = React.useMemo(() => {
    const data = rows.slice();
    const { key, dir } = sort;
    const get = (r: WatchItem) => (String((r as any)[key] ?? "") || "").toLowerCase();
    data.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [rows, sort]);

  return (
    <div className="wl-table-wrap custom-scroll">
      <table className="wl-table">
        <thead className="wl-thead">
          <tr className="wl-head-row">
            {/* Sticky Ticker */}
            <th className="wl-th sticky left-0 z-30 bg-gray-100/80 backdrop-blur">
              <button
                type="button"
                onClick={() =>
                  applySort({
                    key: "Ticker",
                    dir: sort.key === "Ticker" && sort.dir === "asc" ? "desc" : "asc",
                  })
                }
                className="inline-flex items-center gap-1 text-white"
              >
                <span>Ticker</span>
                <Caret active={sort.key === "Ticker"} dir={sort.dir} />
              </button>
            </th>

            <TH label="Company" sortKey="Company" sort={sort} applySort={applySort} />
            <TH label="Theme(s)" sortKey="Theme(s)" sort={sort} applySort={applySort} />
            <TH label="Date analyzed" sortKey="Date analyzed" sort={sort} applySort={applySort} />
            <TH label="Thesis" sortKey="Thesis Snapshot" sort={sort} applySort={applySort} />
            <TH label="2026 Catalysts" sortKey="Key 2026 Catalysts" sort={sort} applySort={applySort} />
            <TH label="What Moves It" sortKey="What Moves It (Triggers)" sort={sort} applySort={applySort} />
            <TH label="Catalyst Path" sortKey="Catalyst Path" sort={sort} applySort={applySort} />
            <TH label="Notes" sortKey="Notes" sort={sort} applySort={applySort} />
          </tr>
        </thead>

        <tbody>
          {sorted.map((r, i) => {
            const zebra = i % 2 === 0 ? "wl-row wl-row--even" : "wl-row";
            return (
              <tr key={`${r.Ticker}-${i}`} className={zebra}>
                <td
                  className="wl-ticker-cell"
                  title={r.Ticker}
                  onClick={() =>
                    window.open(
                      `https://www.tradingview.com/chart/WiBJEuAh/?symbol=${encodeURIComponent(r.Ticker)}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <span className="wl-ticker-chip">{r.Ticker || "—"}</span>
                </td>

                <Cell value={r.Company} />
                <Cell value={r["Theme(s)"]} title={r["Theme(s)"]} />
                <Cell value={r["Date analyzed"] || "—"} />
                <Cell value={r["Thesis Snapshot"]} long />
                <Cell value={r["Key 2026 Catalysts"]} long />
                <Cell value={r["What Moves It (Triggers)"]} long />
                <Cell value={r["Catalyst Path"]} long />
                <Cell value={r.Notes} long />
              </tr>
            );
          })}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="wl-empty">
                No items match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
