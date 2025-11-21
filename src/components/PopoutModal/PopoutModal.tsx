// src/components/PopoutModal/PopoutModal.tsx
import React from "react";
import { MASSIVE_API_KEY } from "../../lib/env";
import PopoutChart from "../PopoutChart/PopoutChart";

type Props = {
  ticker: string;
  open: boolean;
  onClose: () => void;

  // NEW: watchlist fields moved from table into the modal
  thesis?: string;
  catalysts2026?: string;
  whatMovesIt?: string;
};

const MASSIVE_BASE = "https://api.massive.com";

type MassiveTicker = {
  results?: {
    ticker?: string;
    name?: string;
    primary_exchange?: string;
    market_cap?: number;
    phone_number?: string;
    homepage_url?: string;
    list_date?: string;
    locale?: string;
    market?: string;
    sic_code?: string;
    sic_description?: string;
    share_class_shares_outstanding?: number;
    weighted_shares_outstanding?: number;
    description?: string;
    branding?: { logo_url?: string; icon_url?: string };
    ticker_root?: string;
    total_employees?: number;
  };
  status?: string;
};

function n(x?: number | null): string {
  if (x == null) return "—";
  if (x >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (x >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  return `$${x.toLocaleString()}`;
}

export default function PopoutModal({
  ticker,
  open,
  onClose,
  thesis,
  catalysts2026,
  whatMovesIt,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<MassiveTicker | null>(null);

  React.useEffect(() => {
    if (!open || !ticker) return;
    let aborted = false;

    async function run() {
      setLoading(true);
      try {
        const url = `${MASSIVE_BASE}/v3/reference/tickers/${encodeURIComponent(
          ticker
        )}?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;
        const res = await fetch(url);
        const json: MassiveTicker = await res.json();
        if (!aborted) setData(json);
      } catch (e) {
        if (!aborted) setData(null);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [open, ticker]);

  if (!open) return null;

  const r = data?.results;
  const logo = r?.branding?.logo_url
    ? `${r.branding.logo_url}?apiKey=${MASSIVE_API_KEY}`
    : undefined;

  return (
    <div className="wl-modal-overlay" onClick={onClose}>
      <div className="wl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wl-modal-header">
          <div className="wl-modal-title">
            {logo ? (
              <img className="wl-modal-logo" src={logo} alt="" />
            ) : (
              <div className="wl-modal-logo" />
            )}
            <div>
              <div className="wl-modal-name">{r?.name ?? ticker}</div>
              <div className="wl-modal-sub">
                <span className="wl-chip">{r?.ticker ?? ticker}</span>
                <span className="wl-dot" />
                <span>{r?.primary_exchange ?? "—"}</span>
                <span className="wl-dot" />
                <span>Root: {r?.ticker_root ?? "—"}</span>
              </div>
            </div>
          </div>
          <button className="wl-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="wl-modal-content custom-scroll">
          {/* Left column - key facts + moved watchlist text fields */}
          <div className="wl-modal-col">
            <div className="wl-kv">
              <span>Market cap</span>
              <strong>{n(r?.market_cap as number)}</strong>
            </div>
            <div className="wl-kv">
              <span>Total employees</span>
              <strong>{r?.total_employees?.toLocaleString() ?? "—"}</strong>
            </div>
            <div className="wl-kv">
              <span>List date</span>
              <strong>
                {r?.list_date ? new Date(r.list_date).toLocaleDateString() : "—"}
              </strong>
            </div>
            <div className="wl-kv">
              <span>Shares outstanding (share class)</span>
              <strong>
                {r?.share_class_shares_outstanding
                  ? r.share_class_shares_outstanding.toLocaleString()
                  : "—"}
              </strong>
            </div>
            <div className="wl-kv">
              <span>Weighted shares outstanding</span>
              <strong>
                {r?.weighted_shares_outstanding
                  ? r.weighted_shares_outstanding.toLocaleString()
                  : "—"}
              </strong>
            </div>
            <div className="wl-kv">
              <span>SIC</span>
              <strong>
                {r?.sic_code ? `${r.sic_code} — ${r?.sic_description ?? ""}` : "—"}
              </strong>
            </div>
            <div className="wl-kv">
              <span>Website</span>
              <strong>
                {r?.homepage_url ? (
                  <a
                    href={r.homepage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="wl-link"
                  >
                    {r.homepage_url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                )}
              </strong>
            </div>
            <div className="wl-kv">
              <span>Phone</span>
              <strong>{r?.phone_number ?? "—"}</strong>
            </div>

            {/* NEW: Watchlist narrative fields */}
            <div className="wl-section">
              <div className="wl-section-title">Thesis snapshot</div>
              <p className="wl-description">{thesis || "—"}</p>
            </div>

            <div className="wl-section">
              <div className="wl-section-title">Key 2026 catalysts</div>
              <p className="wl-description">{catalysts2026 || "—"}</p>
            </div>

            <div className="wl-section">
              <div className="wl-section-title">What moves it (triggers)</div>
              <p className="wl-description">{whatMovesIt || "—"}</p>
            </div>
          </div>

          {/* Right column - description + chart */}
          <div className="wl-modal-col">
            <div className="wl-section">
              <div className="wl-section-title">Company description</div>
              <p className="wl-description">
                {loading && !r ? "Loading…" : r?.description ?? "—"}
              </p>
            </div>

            <div className="wl-section">
              <div className="wl-section-title">Price chart</div>
              <PopoutChart ticker={ticker} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
