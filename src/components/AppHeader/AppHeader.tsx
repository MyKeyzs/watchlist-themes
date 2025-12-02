// src/components/AppHeader.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import "./AppHeader.css";
import { useAuth } from "../../contexts/AuthContext"; // <- add this

const AppHeader: React.FC = () => {
  const { logout } = useAuth(); // assumes AuthContext exposes logout()

  const handleLogout = async () => {
    try {
      await logout();
      // optional: you could navigate to /login here if your AuthContext
      // doesn't already redirect on sign-out.
    } catch (err) {
      console.error("Failed to logout", err);
    }
  };


   // Parent pill should look active for either S&P route
  const isSp500Active = location.pathname.startsWith("/sp500");
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
        </nav>
        <div className="app-header__dropdown">
            <button
              type="button"
              className={
                "app-header__link app-header__link--dropdown" +
                (isSp500Active ? " app-header__link--active" : "")
              }
            >
              S&amp;P 500
              <span className="app-header__caret">▾</span>
            </button>

            <div className="app-header__dropdown-menu">
              <NavLink
                to="/sp500"
                className={({ isActive }) =>
                  "app-header__dropdown-item" +
                  (isActive ? " app-header__dropdown-item--active" : "")
                }
              >
                SPY YTD
              </NavLink>

              <NavLink
                to="/sp500-heatmap"
                className={({ isActive }) =>
                  "app-header__dropdown-item" +
                  (isActive ? " app-header__dropdown-item--active" : "")
                }
              >
                SPY HeatMap
              </NavLink>
            </div>
          </div>

        {/* Right side: logout */}
        <div className="app-header__right">
          <button
            type="button"
            className="app-header__logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;