import React from "react";

type Props = {
  uniqueDates: string[];
  selectedDates: Set<string>;
  onToggleDate: (d: string) => void;
  onClearDates: () => void;
  /** Optional: show a badge with how many dates are selected */
  selectedCount?: number;
};

export default function DateFilter({
  uniqueDates,
  selectedDates,
  onToggleDate,
  onClearDates,
  selectedCount,
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="wl-datefilter">
      <button
        type="button"
        className="wl-btn wl-btn--menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span role="img" aria-label="calendar" className="mr-1">
          📅
        </span>
        Filter by date{" "}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
        {typeof selectedCount === "number" && selectedCount > 0 && (
          <span className="wl-badge">{selectedCount}</span>
        )}
      </button>

      {open && (
        <div className="wl-menu">
          <div className="wl-menu-head">
            <span>DATE ANALYZED</span>
            <button className="wl-menu-clear" onClick={onClearDates}>
              Clear dates
            </button>
          </div>
          <div className="wl-menu-body custom-scroll">
            {uniqueDates.length === 0 && (
              <div className="wl-menu-empty">No dates</div>
            )}
            {uniqueDates.map((d) => {
              const on = selectedDates.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`wl-menu-item ${on ? "wl-menu-item--on" : ""}`}
                  onClick={() => onToggleDate(d)}
                >
                  <span className="wl-menu-check">{on ? "✓" : ""}</span>
                  <span>{d}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
