// src/components/AppHeader.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import "./AppHeader.css"

const AppHeader: React.FC = () => {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        {/* Left: brand / logo text */}
        <div className="app-header__brand">
          <span className="app-header__brand-mark">AI</span>
          <span className="app-header__brand-text">Wealth Console</span>
        </div>

        {/* Center: main nav tabs */}
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
        </nav>

        {/* Right side – optional space for icons/buttons later */}
        <div className="app-header__right">
          {/* leave empty for now; add profile/settings later if you want */}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
