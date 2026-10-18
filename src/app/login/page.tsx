"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login, logout, user, isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const u = await login(username.trim(), password);
      toast(`Signed in successfully as ${u.username}`, "success");
      router.push("/");
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : "Authentication failed.";
      setErrorMsg(detail);
      toast(detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setUsername("admin");
    setPassword("admin123");
    setErrorMsg(null);
  };

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", width: "100%", padding: "24px 16px" }}>
      <div className="card" style={{ maxWidth: 450, width: "100%", padding: 36, margin: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(135deg, var(--brand), #a78bfa)",
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              boxShadow: "0 8px 24px var(--brand-glow)",
            }}
          >
            🛡️
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
            Compliance <span className="grad">Admin Login</span>
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0 }}>
            Sign in with administrative privileges to manage governance, approve agent execution plans, and trigger reversible migrations.
          </p>
        </div>

        {isAuthenticated && user ? (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="alert info">
              Signed in as <strong>{user.username}</strong> ({user.email})
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => router.push("/")}
              >
                Go to Cockpit →
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => logout()}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {errorMsg && (
              <div className="alert error">
                <strong>Access Denied:</strong> {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="login-username" className="field-label">
                Admin Username or Email
              </label>
              <input
                id="login-username"
                className="input"
                type="text"
                autoComplete="username"
                placeholder="e.g. admin or compliance.admin@enterprise.local"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="field-label">
                Admin Master Password
              </label>
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter admin password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <button
              type="submit"
              id="btn-admin-login"
              className="btn primary"
              style={{ width: "100%", padding: 12, marginTop: 4 }}
              disabled={submitting || !username.trim() || !password.trim()}
            >
              {submitting ? (
                <>
                  <span className="spinner" /> Verifying Credentials…
                </>
              ) : (
                "🔐 Sign In as Administrator"
              )}
            </button>

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                type="button"
                id="btn-quick-fill-demo"
                className="chip"
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={fillDemoCredentials}
              >
                <span>🔑</span> Fill Demo Credentials (admin / admin123)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
