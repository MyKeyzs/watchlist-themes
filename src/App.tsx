// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WatchlistPage from "./pages/WatchlistPage";
import HoldingsPage from "../src/pages/HoldingPage";
import AppHeader from "../src/components/AppHeader/AppHeader";
import "./styles/watchlist.light.css"; // your existing theme
import "../src/components/AppHeader/AppHeader.css";   // new header + layout styles

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <AppHeader />

        <main className="app-main">
          <Routes>
            {/* A.I Watchlist (current page) */}
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

            {/* optional: alias /ai-watchlist → / */}
            <Route path="/ai-watchlist" element={<Navigate to="/" replace />} />

            {/* My holdings (blank for now) */}
            <Route path="/holdings" element={<HoldingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
