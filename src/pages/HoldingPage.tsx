// src/pages/HoldingsPage.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import HoldingsTable from "../components/HoldingsTable/HoldingsTable";
//import App from "../App.css";

export default function HoldingsPage() {
  const { user } = useAuth();

  if (!user) {
    // Route is already protected, but this keeps TS happy.
    return null;
  }

  return (
    <div className="wl-root">
      <div className="wl-container">
        <header className="wl-page-header">
          <h1 className="wl-title">My Holdings</h1>
          <p className="wl-subtitle">
            Signed in as {user.email ?? "unknown user"}.
          </p>
        </header>

        <HoldingsTable uid={user.uid} />
      </div>
    </div>
  );
}