// src/components/HoldingsPopout/HoldingsPopout.tsx
import React from "react";
import "./HoldingsPopout.css";   // <-- IMPORTANT: make sure this line exists

export type HoldingsFormValues = {
  ticker: string;
  sector: string;
  subSector: string;
  quantity: string;
  avgCost: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (values: HoldingsFormValues) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
};

const emptyForm: HoldingsFormValues = {
  ticker: "",
  sector: "",
  subSector: "",
  quantity: "",
  avgCost: "",
};

const HoldingsPopout: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  saving = false,
  error,
}) => {
  const [values, setValues] = React.useState<HoldingsFormValues>(emptyForm);

  // reset when opened
  React.useEffect(() => {
    if (open) setValues(emptyForm);
  }, [open]);

  if (!open) return null;

  const handleChange =
    (field: keyof HoldingsFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(values);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // prevent closing when clicking inside the dialog
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="holdings-popout-overlay"
      onClick={handleOverlayClick}
    >
      <div className="holdings-popout">
        <header className="holdings-popout-header">
          <h2 className="holdings-popout-title">Add Holding</h2>
          <button
            type="button"
            className="holdings-popout-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="holdings-popout-body">
          <div className="holdings-popout-grid">
            <div className="holdings-popout-field">
              <label className="holdings-popout-label">Ticker</label>
              <input
                className="holdings-popout-input"
                placeholder="e.g. NVDA"
                value={values.ticker}
                onChange={handleChange("ticker")}
              />
            </div>

            <div className="holdings-popout-field">
              <label className="holdings-popout-label">
                Sector (optional)
              </label>
              <input
                className="holdings-popout-input"
                placeholder="e.g. Technology"
                value={values.sector}
                onChange={handleChange("sector")}
              />
            </div>

            <div className="holdings-popout-field">
              <label className="holdings-popout-label">
                Sub-Sector (optional)
              </label>
              <input
                className="holdings-popout-input"
                placeholder="e.g. Smartphones"
                value={values.subSector}
                onChange={handleChange("subSector")}
              />
            </div>

            <div className="holdings-popout-field">
              <label className="holdings-popout-label">Quantity</label>
              <input
                className="holdings-popout-input"
                placeholder="e.g. 100"
                value={values.quantity}
                onChange={handleChange("quantity")}
              />
            </div>

            <div className="holdings-popout-field">
              <label className="holdings-popout-label">Avg Cost</label>
              <input
                className="holdings-popout-input"
                placeholder="e.g. 425.50"
                value={values.avgCost}
                onChange={handleChange("avgCost")}
              />
            </div>
          </div>

          {error && (
            <div className="holdings-popout-error">{error}</div>
          )}

          <footer className="holdings-popout-footer">
            <button
              type="button"
              className="wl-btn wl-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="wl-btn"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default HoldingsPopout;
