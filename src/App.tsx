// src/App.tsx
import React from "react";
import WatchlistPage from "./pages/WatchlistPage";
import "./styles/watchlist.light.css"; // global styles

export default function App() {
  return (
    <WatchlistPage
      title="Permanent Thematic Watchlist"
      csvUrl="/watchlist_live.csv" // make sure the CSV is in /public/watchlist_web.csv
      linkedinUrl="https://www.linkedin.com/in/mmiamckinmmckiney"
      twitterUrl="https://twitter.com/mmykeyy"
    />
  );
}