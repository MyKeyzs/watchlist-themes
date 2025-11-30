// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;

  // where to go after login (default → holdings)
  const from = location.state?.from?.pathname ?? "/holdings";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg =
        err?.message ||
        "Something went wrong. Please check your credentials and try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h1 className="auth-title">Invest the Nest</h1>
        <p className="auth-subtitle">
          Sign in to view your holdings &amp; watchlists.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={
              "auth-tab" + (mode === "login" ? " auth-tab--active" : "")
            }
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={
              "auth-tab" + (mode === "signup" ? " auth-tab--active" : "")
            }
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Working..."
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
