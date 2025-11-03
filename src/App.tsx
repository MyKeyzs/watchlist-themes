import ThematicWatchlist from "./ThematicWatchlist";

export default function App() {
  return (
    <ThematicWatchlist
      title="Permanent Thematic Watchlist"
      csvUrl="/permanent_thematic_watchlist_2026.csv"
      wsUrl="ws://localhost:8787"
    />
  );
}
