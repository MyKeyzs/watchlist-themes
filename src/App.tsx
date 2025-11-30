// src/App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from "react-router-dom";

import WatchlistPage from "./pages/WatchlistPage";
import HoldingsPage from "../src/pages/HoldingPage";
import LoginPage from "../src/pages/LoginPage";
import Sp500YtdPage from "../src/pages/Sp500YtdPage";

import { AuthProvider, useAuth } from "./contexts/AuthContext";

import "../src/styles/index.css"
import "./styles/watchlist.light.css";
import "../src/components/AppHeader/AppHeader.css"

/* ---------- Header ---------- */

function AppHeader({
  active,
}: {
  active: "holdings" | "watchlist" | "sp500";
}) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <div className="app-header__brand-mark">IN</div>
          <span className="app-header__brand-text">Invest the Nest</span>
        </div>

        <nav className="app-header__nav">
          <Link
            to="/holdings"
            className={
              "app-header__link" +
              (active === "holdings" ? " app-header__link--active" : "")
            }
          >
            My Holdings
          </Link>

          <Link
            to="/watchlist"
            className={
              "app-header__link" +
              (active === "watchlist" ? " app-header__link--active" : "")
            }
          >
            A.I. Watchlist
          </Link>

          <Link
            to="/sp500-ytd"
            className={
              "app-header__link" +
              (active === "sp500" ? " app-header__link--active" : "")
            }
          >
            S&amp;P 500 YTD
          </Link>
        </nav>

        <div className="app-header__right" />
      </div>
    </header>
  );
}

/* ---------- Auth guard ---------- */

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="wl-empty">Checking your session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/* ---------- App ---------- */

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Login is public */}
          <Route path="/login" element={<LoginPage />} />

          {/* My Holdings = HOME (protected) */}
          <Route
            path="/holdings"
            element={
              <RequireAuth>
                <>
                  <AppHeader active="holdings" />
                  <HoldingsPage />
                </>
              </RequireAuth>
            }
          />

          {/* Watchlist (protected) */}
          <Route
            path="/watchlist"
            element={
              <RequireAuth>
                <>
                  <AppHeader active="watchlist" />
                  <WatchlistPage
                    title="Permanent Thematic Watchlist"
                    csvUrl="/watchlist_live.csv"
                    linkedinUrl="https://www.linkedin.com/in/mmiamckinmmckiney"
                    twitterUrl="https://twitter.com/mmykeyy"
                  />
                </>
              </RequireAuth>
            }
          />

          {/* S&P 500 YTD page (protected) */}
          <Route
            path="/sp500-ytd"
            element={
              <RequireAuth>
                <>
                  <AppHeader active="sp500" />
                  <Sp500YtdPage />
                </>
              </RequireAuth>
            }
          />

          {/* Root → holdings as home */}
          <Route path="/" element={<Navigate to="/holdings" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/holdings" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
