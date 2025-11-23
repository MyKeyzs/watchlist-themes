
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WatchlistPage from "./pages/WatchlistPage";
import HoldingsPage from "../src/pages/HoldingPage";
import Sp500YtdPage from "./pages/Sp500YtdPage";   // 👈 sANDp500 component
import AppHeader from "../src/components/AppHeader/AppHeader";
import "./App.css";
import "./styles/watchlist.light.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <AppHeader />

        <main className="app-main">
          <Routes>
            {/* A.I Watchlist */}
            <Route
              path="/"
              element={
                <WatchlistPage
                  title="Permanent Thematic Watchlist"
                  csvUrl="/watchlist_live.csv"
                  linkedinUrl="https://www.linkedin.com/in/mmiamckinmmckiney"
                  twitterUrl="https://twitter.com/mmykeyy"
                />
              }
            />

            {/* My holdings (placeholder) */}
            <Route path="/holdings" element={<HoldingsPage />} />

            {/* S&P 500 YTD page */}
            <Route path="/sp500" element={<Sp500YtdPage />} />

            {/* Optional alias */}
            <Route path="/ai-watchlist" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}