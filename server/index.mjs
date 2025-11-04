import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const API_BASE = "https://api.massive.app"; // Massive API base

// Bulk daily closes for all US stocks (fastest for your use-case)
app.get("/api/grouped", async (req, res) => {
  try {
    const { date, adjusted = "true", include_otc = "false" } = req.query;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

    const url = new URL(`/v2/aggs/grouped/locale/us/market/stocks/${date}`, API_BASE);
    url.searchParams.set("adjusted", adjusted);
    url.searchParams.set("include_otc", include_otc);

    const r = await fetch(url, {
      headers: {
        "accept": "application/json",
        "x-api-key": process.env.MASSIVE_API_KEY || "", // keep key server-side
      },
    });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(500).json({ error: e?.message || "proxy error" });
  }
});

// Optional: single ticker/day endpoint
app.get("/api/open-close", async (req, res) => {
  try {
    const { ticker, date, adjusted = "true" } = req.query;
    if (!ticker || !date) return res.status(400).json({ error: "ticker and date are required" });

    const url = new URL(`/v1/open-close/${ticker}/${date}`, API_BASE);
    url.searchParams.set("adjusted", adjusted);

    const r = await fetch(url, {
      headers: {
        "accept": "application/json",
        "x-api-key": process.env.MASSIVE_API_KEY || "",
      },
    });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(500).json({ error: e?.message || "proxy error" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Proxy listening on http://localhost:${port}`));
