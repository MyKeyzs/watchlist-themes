
// src/components/ThemeChips/ThemeChips.tsx
export default function ThemeChips({
  allThemes, themesSelected, currentTheme, isAllSelected,
  onToggleTheme, onClearThemes, onToggleAll
}: {
  allThemes: string[];
  themesSelected: string[];
  currentTheme: string | null;
  isAllSelected: boolean;
  onToggleTheme: (t: string) => void;
  onClearThemes: () => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="wl-themes-outer">
      <div className="wl-chip-row">
        <button
          className="wl-pill wl-pill--all"
          onClick={onToggleAll}
          title={isAllSelected ? "Deselect all themes" : "Select all themes"}
        >
          All themes
        </button>
        <button className="wl-clear" onClick={onClearThemes}>Clear themes</button>
      </div>

      <div className="wl-themes">
        <div className="wl-chip-row">
          {allThemes.map(t => {
            const isSelected = themesSelected.includes(t);
            const isCurrent  = isSelected && currentTheme === t;
            const cls = isSelected
              ? (isCurrent ? "wl-pill wl-pill--current" : "wl-pill wl-pill--prev")
              : "wl-pill wl-pill--idle";
            return (
              <button key={t} className={cls} onClick={() => onToggleTheme(t)}>
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
