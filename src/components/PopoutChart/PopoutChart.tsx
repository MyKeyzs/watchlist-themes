// src/components/PopoutChart.tsx
import React from "react";

type Props = {
  ticker: string;
};

export default function PopoutChart({ ticker }: Props) {
  // TODO: implement real chart later (Polygon, Massive aggs, or TV widget)
  return (
    <div className="wl-chart-placeholder">
      Chart for <strong>{ticker}</strong> coming soon…
    </div>
  );
}
