// src/pages/HoldingsPage.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function HoldingsPage() {
  const { user } = useAuth();

  return (
    <div className="wl-root">
      <div className="wl-container">
        <header className="wl-page-header">
          <h1 className="wl-title">My Holdings</h1>
          <p className="wl-subtitle">
            {user
              ? `Signed in as ${user.email ?? "unknown user"}`
              : "You are not signed in."}
          </p>
        </header>

        {/* TODO: replace this with your real holdings table */}
        <div className="wl-card" style={{ marginTop: "1.5rem", padding: "1.5rem" }}>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            This is where your personal holdings dashboard will go. You can
            store per-user holdings in Firestore (users/{`{uid}`}/holdings)
            and render them here.
          </p>
        </div>
      </div>
    </div>
  );
}