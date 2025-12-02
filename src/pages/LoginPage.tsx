// src/pages/LoginPage.tsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // pull user as well so we can redirect when it becomes non-null
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;

  // where to go after login (default → holdings)
  const from: string = location.state?.from?.pathname ?? "/holdings";

  /**
   * As soon as Firebase/AuthContext reports a logged-in user,
   * send them to the intended page. This keeps navigation in sync
   * with the real auth state and avoids the "have to click twice"
   * issue.
   */
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, from, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        // just perform the login; redirect happens in the useEffect above
        await login(email, password);
      } else {
        await register(email, password);
      }
      // DO NOT navigate here – let the effect run once user is set
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

          <button className="auth-submit" type="submit" disabled={submitting}>
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