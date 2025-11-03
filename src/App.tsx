// src/App.tsx
import ThematicWatchlist from "./ThematicWatchlist";

export default function App() {
  return (
    <ThematicWatchlist
      title="Permanent Thematic Watchlist"
      csvUrl="/watchlist_web.csv"   // <- use the merged file
    />
  );
}