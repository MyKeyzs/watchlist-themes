import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder?: string;
};

export default function SearchBox({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
}: Props) {
  return (
    <div className="wl-search-wrap">
      <input
        className="wl-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button type="button" className="wl-btn" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}
