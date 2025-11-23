// src/components/AppHeader.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import "./AppHeader.css";

const AppHeader: React.FC = () => {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        {/* Left: brand */}
        <div className="app-header__brand">
          <span className="app-header__brand-mark">AI</span>
          <span className="app-header__brand-text">Wealth Console</span>
        </div>

        {/* Center: nav tabs */}
        <nav className="app-header__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              "app-header__link" +
              (isActive ? " app-header__link--active" : "")
            }
          >
            A.I Watchlist
          </NavLink>

          <NavLink
            to="/holdings"
            className={({ isActive }) =>
              "app-header__link" +
              (isActive ? " app-header__link--active" : "")
            }
          >
            My holdings
          </NavLink>

          <NavLink
            to="/sp500"
            className={({ isActive }) =>
              "app-header__link" +
              (isActive ? " app-header__link--active" : "")
            }
          >
            S&amp;P 500 Companies YTD 
          </NavLink>
        </nav>

        {/* Right side: placeholder for future profile/settings */}
        <div className="app-header__right" />
      </div>
    </header>
  );
};

export default AppHeader;
