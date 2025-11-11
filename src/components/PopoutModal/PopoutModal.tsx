// src/components/PopoutModal.tsx
import React from "react";
import { MASSIVE_API_KEY } from "../../lib/env";

/** Subset of Massive v3 /reference/tickers response we display. */
type Branding = {
  icon_url?: string | null;
  logo_url?: string | null;
};
type TickerReference = {
  branding?: Branding;
  description?: string | null;
  homepage_url?: string | null;
  list_date?: string | null;
  locale?: string | null;
  market_cap?: number | null;
  name?: string | null;
  phone_number?: string | null;
  primary_exchange?: string | null;
  share_class_shares_outstanding?: number | null;
  sic_code?: string | null;
  sic_description?: string | null;
  ticker?: string | null;
  ticker_root?: string | null;
  total_employees?: number | null;
  weighted_shares_outstanding?: number | null;
};

type ApiResponse = { results?: TickerReference; status?: string };

export type PopoutModalProps = {
  ticker: string;          // e.g., "AAPL"
  open: boolean;
  onClose: () => void;
};

const MASSIVE_BASE = "https://api.massive.com";

function fmtInt(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}
function fmtMoney(n?: number | null) {
  if (n == null) return "—";
  // Compact USD display
  return Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  // Massive gives YYYY-MM-DD; show friendly
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function PopoutModal({ ticker, open, onClose }: PopoutModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<TickerReference | null>(null);

  React.useEffect(() => {
    if (!open || !ticker) return;
    let aborted = false;
    setLoading(true);
    setErr(null);
    setData(null);

    (async () => {
      try {
        const url = `${MASSIVE_BASE}/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!aborted) setData(json.results ?? null);
      } catch (e: any) {
        if (!aborted) setErr(e?.message ?? "Failed to fetch");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [open, ticker]);

  if (!open) return null;

  const logo = data?.branding?.logo_url ?? data?.branding?.icon_url ?? null;

  return (
    <div className="wl-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="wl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wl-modal-header">
          <div className="wl-modal-title">
            {logo ? <img src={logo} alt={`${data?.name ?? ticker} logo`} className="wl-modal-logo" /> : null}
            <div>
              <div className="wl-modal-name">{data?.name ?? "—"}</div>
              <div className="wl-modal-sub">
                <span className="wl-chip">{data?.ticker ?? ticker}</span>
                {data?.primary_exchange ? <span className="wl-dot">•</span> : null}
                {data?.primary_exchange ? <span>{data.primary_exchange}</span> : null}
                {data?.ticker_root ? <span className="wl-dot">•</span> : null}
                {data?.ticker_root ? <span>Root: {data.ticker_root}</span> : null}
              </div>
            </div>
          </div>
          <button className="wl-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="wl-modal-content">
          {/* Left: key stats */}
          <div className="wl-modal-col">
            <div className="wl-kv"><span>Market cap</span><strong>{fmtMoney(data?.market_cap)}</strong></div>
            <div className="wl-kv"><span>Total employees</span><strong>{fmtInt(data?.total_employees)}</strong></div>
            <div className="wl-kv"><span>List date</span><strong>{fmtDate(data?.list_date)}</strong></div>
            <div className="wl-kv"><span>Shares outstanding (share class)</span><strong>{fmtInt(data?.share_class_shares_outstanding)}</strong></div>
            <div className="wl-kv"><span>Weighted shares outstanding</span><strong>{fmtInt(data?.weighted_shares_outstanding)}</strong></div>
            <div className="wl-kv"><span>SIC</span><strong>{data?.sic_code ?? "—"}{data?.sic_description ? ` — ${data.sic_description}` : ""}</strong></div>
            <div className="wl-kv"><span>Website</span>
              {data?.homepage_url ? (
                <a href={data.homepage_url} target="_blank" rel="noreferrer" className="wl-link">{data.homepage_url}</a>
              ) : <strong>—</strong>}
            </div>
            <div className="wl-kv"><span>Phone</span><strong>{data?.phone_number ?? "—"}</strong></div>
          </div>

          {/* Right: description + chart placeholder */}
          <div className="wl-modal-col">
            <div className="wl-section">
              <div className="wl-section-title">Company description</div>
              <p className="wl-description">{data?.description ?? "—"}</p>
            </div>

            <div className="wl-section">
              <div className="wl-section-title">Price chart</div>
              {/* Placeholder for now; we’ll implement PopoutChart.tsx later */}
              <div className="wl-chart-placeholder">
                <em>PopoutChart will render here.</em>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
