"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { api, API_URL, ApiError } from "@/lib/api";
import type { Health } from "@/lib/types";
import { ToastProvider, useToast } from "./Toast";

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: string;
}

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Agent Cockpit",
    icon: (active) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
        <polyline points="9 21 9 12 15 12 15 21" />
      </svg>
    ),
  },
  {
    href: "/crm",
    label: "CRM Data",
    icon: (active) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      </svg>
    ),
    badge: "Live",
  },
  {
    href: "/audit",
    label: "Audit & Rollback",
    icon: (active) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    href: "/governance",
    label: "Governance",
    icon: (active) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const HEALTH_KEYS: [keyof Health, string][] = [
  ["postgres_governance_db", "Governance DB"],
  ["postgres_staging_db", "Staging DB"],
  ["redis", "Redis"],
  ["fastmcp_sandbox", "FastMCP"],
];

function dotClass(v?: string) {
  if (v === "HEALTHY") return "ok";
  if (v === "DEGRADED") return "warn";
  return v ? "bad" : "";
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Strict route protection: redirect unauthenticated users to /login
  useEffect(() => {
    if (!loading && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, pathname, router]);

  // If already authenticated and on /login, redirect to /
  useEffect(() => {
    if (!loading && isAuthenticated && pathname === "/login") {
      router.replace("/");
    }
  }, [loading, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.health();
        if (alive) {
          setHealth(h);
          setOffline(false);
        }
      } catch {
        if (alive) setOffline(true);
      }
    };
    void tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      const r = await api.seed();
      toast(`Seeded ${r.clients_seeded} dirty clients & ${r.invoices_seeded} invoices`, "success");
      window.dispatchEvent(new Event("crm:changed"));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Seeding failed", "error");
    } finally {
      setSeeding(false);
    }
  }, [toast]);

  // 1. Initial loading state while verifying JWT token
  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, marginBottom: 16 }} />
          <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Verifying Administrative Session…
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: on /login, render clean focused login view without sidebar
  if (!isAuthenticated) {
    if (pathname === "/login") {
      return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", width: "100%" }}>{children}</main>;
    }
    // Access denied / redirecting state
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ textAlign: "center", color: "var(--text-dim)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>Access Restricted</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Redirecting to administrator sign in…</div>
        </div>
      </div>
    );
  }

  // 3. Authenticated: render full enterprise dashboard shell
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Compliance Gateway</div>
            <div className="brand-sub">Agentic Data Ops</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                id={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className="nav-link"
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden>{n.icon(active)}</span>
                <span>{n.label}</span>
                {n.badge && <span className="nav-badge">{n.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          {user && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            >
              <div style={{ color: "#ffffff", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 8px var(--brand)" }} />
                <span>{user.username}</span>
                <span style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>(Admin)</span>
              </div>
              <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
            </div>
          )}
          <button id="btn-seed-demo" className="btn sm" onClick={seed} disabled={seeding || offline}>
            {seeding ? <span className="spinner" /> : "🌱"} Seed Dirty CRM Data
          </button>
          <div className="env-chip">{health?.environment ?? "—"} · {API_URL.replace("http://", "")}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="health-bar" aria-label="System health" id="health-bar">
            {offline ? (
              <span className="health-pill"><span className="dot bad" /> API offline</span>
            ) : (
              HEALTH_KEYS.map(([k, label]) => (
                <span key={k} className="health-pill" title={String(health?.[k] ?? "checking")}>
                  <span className={`dot ${dotClass(health?.[k] as string)}`} />
                  {label}
                </span>
              ))
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="badge cyan">🔒 PII guardrail active</span>

            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge green" title={user.email}>
                  ✓ {user.username}
                </span>
                <button
                  type="button"
                  id="btn-admin-logout"
                  className="btn sm"
                  style={{ padding: "4px 8px", fontSize: 11.5 }}
                  onClick={() => {
                    logout();
                    router.replace("/login");
                  }}
                  title="Sign out of admin session"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </AuthProvider>
  );
}
