// src/pages/HoldingsPage.tsx
import React from "react";

const HoldingsPage: React.FC = () => {
  return (
    <section className="page page--holdings">
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
        My holdings
      </h1>
      <p style={{ maxWidth: 600, lineHeight: 1.5 }}>
        This page will eventually let you create custom watchlists and add
        tickers with your own notes, sizing, and PnL. For now it’s just a
        placeholder route so the top navigation works.
      </p>
    </section>
  );
};

export default HoldingsPage;