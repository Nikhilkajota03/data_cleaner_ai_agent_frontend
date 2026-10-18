"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Client, ClientDetail, CrmStats, Invoice } from "@/lib/types";
import { fmtDate, isIsoCountry, isValidPhone, shortId } from "@/lib/format";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

function getInitials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CrmDataPage() {
  const [tab, setTab] = useState<"clients" | "invoices">("clients");
  const [stats, setStats] = useState<CrmStats | null>(null);

  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [includeDeletedClients, setIncludeDeletedClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [includeDeletedInvoices, setIncludeDeletedInvoices] = useState(false);

  const toast = useToast();

  const loadStats = useCallback(async () => {
    try {
      const s = await api.crmStats();
      setStats(s);
    } catch {
      /* ignore background stats failure */
    }
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const res = await api.clients({
        search: clientSearch || undefined,
        include_deleted: includeDeletedClients,
        limit: 100,
      });
      setClients(res);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to load clients", "error");
    } finally {
      setClientsLoading(false);
    }
  }, [clientSearch, includeDeletedClients, toast]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await api.invoices({
        include_deleted: includeDeletedInvoices,
        limit: 100,
      });
      setInvoices(res);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to load invoices", "error");
    } finally {
      setInvoicesLoading(false);
    }
  }, [includeDeletedInvoices, toast]);

  const inspectClient = async (id: string) => {
    try {
      const detail = await api.client(id);
      setSelectedClient(detail);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not load client detail", "error");
    }
  };

  useEffect(() => {
    void loadStats();
    void loadClients();
    void loadInvoices();

    const onCrmChanged = () => {
      void loadStats();
      void loadClients();
      void loadInvoices();
    };
    window.addEventListener("crm:changed", onCrmChanged);
    return () => window.removeEventListener("crm:changed", onCrmChanged);
  }, [loadStats, loadClients, loadInvoices]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            CRM <span className="grad">Staging Explorer</span>
          </h1>
          <p className="page-desc">
            Direct real-time inspection of staging database entities. Dirty data indicators flag non-standard phone numbers, missing GDPR consent, and unstandardized invoice currencies.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              void loadStats();
              if (tab === "clients") void loadClients();
              else void loadInvoices();
            }}
          >
            🔄 Refresh Records
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid cols-4">
        <div className="stat" style={{ "--accent": "var(--cyan)" } as React.CSSProperties}>
          <span className="stat-label">Active Clients</span>
          <span className="stat-value">{stats?.total_clients ?? "—"}</span>
          <span className="stat-hint">In staging_db</span>
        </div>
        <div className="stat" style={{ "--accent": "var(--red)" } as React.CSSProperties}>
          <span className="stat-label">Malformed Phones</span>
          <span className="stat-value" style={{ color: "var(--red)" }}>
            {stats?.malformed_phones ?? "—"}
          </span>
          <span className="stat-hint">Fails E.164 format</span>
        </div>
        <div className="stat" style={{ "--accent": "var(--amber)" } as React.CSSProperties}>
          <span className="stat-label">Missing GDPR Consent</span>
          <span className="stat-value" style={{ color: "var(--amber)" }}>
            {stats?.missing_gdpr_consent ?? "—"}
          </span>
          <span className="stat-hint">Consent = False</span>
        </div>
        <div className="stat" style={{ "--accent": "var(--violet)" } as React.CSSProperties}>
          <span className="stat-label">Unstandardized Invoices</span>
          <span className="stat-value" style={{ color: "var(--violet)" }}>
            {stats?.unstandardized_invoices ?? "—"}
          </span>
          <span className="stat-hint">Raw strings requiring AI normalization</span>
        </div>
      </div>

      {/* Navigation Tabs & Search Toolbar */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="tabs">
            <button
              type="button"
              className="tab"
              aria-selected={tab === "clients"}
              onClick={() => setTab("clients")}
            >
              👤 Clients ({clients.length})
            </button>
            <button
              type="button"
              className="tab"
              aria-selected={tab === "invoices"}
              onClick={() => setTab("invoices")}
            >
              📄 Invoices ({invoices.length})
            </button>
          </div>

          {tab === "clients" ? (
            <div className="row" style={{ gap: 14 }}>
              <input
                id="search-clients-input"
                className="input"
                style={{ width: 280 }}
                placeholder="Search by name, email, phone, city..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  id="toggle-deleted-clients"
                  checked={includeDeletedClients}
                  onChange={(e) => setIncludeDeletedClients(e.target.checked)}
                />
                Include Soft-Deleted
              </label>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                id="toggle-deleted-invoices"
                checked={includeDeletedInvoices}
                onChange={(e) => setIncludeDeletedInvoices(e.target.checked)}
              />
              Include Soft-Deleted
            </label>
          )}
        </div>
      </div>

      {/* Main Data Tables */}
      {tab === "clients" ? (
        <div className="table-wrap">
          <table className="table" id="clients-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>ID</th>
                <th style={{ minWidth: 220 }}>Client Name</th>
                <th style={{ minWidth: 230 }}>Email</th>
                <th style={{ minWidth: 230 }}>Phone (E.164 Check)</th>
                <th style={{ minWidth: 160 }}>Location</th>
                <th style={{ minWidth: 140 }}>GDPR Consent</th>
                <th style={{ minWidth: 110 }}>Status</th>
                <th style={{ width: 130, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {clientsLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 36 }}>
                    <span className="spinner" /> Loading client records…
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No client records found in staging database. Click "Seed Dirty CRM Data" in the sidebar!
                  </td>
                </tr>
              ) : (
                clients.map((c) => {
                  const phoneValid = isValidPhone(c.phone);
                  const countryValid = isIsoCountry(c.country_code);
                  return (
                    <tr
                      key={c.id}
                      className={`clickable ${c.is_deleted ? "deleted" : ""}`}
                      onClick={() => inspectClient(c.id)}
                    >
                      <td>
                        <span className="mono-chip" title={c.id}>
                          #{shortId(c.id)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 11, whiteSpace: "nowrap" }}>
                          <div className="client-avatar" aria-hidden="true">
                            {getInitials(c.full_name)}
                          </div>
                          <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "13.5px" }}>
                            {c.full_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        {c.email ? (
                          <span style={{ color: "#cbd5e1", whiteSpace: "nowrap" }}>
                            {c.email}
                          </span>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                      <td>
                        {c.phone ? (
                          <div className="phone-cell">
                            <span className="phone-num">{c.phone}</span>
                            {!phoneValid ? (
                              <span className="badge amber" title="Malformed phone number: fails E.164 specification">
                                ⚠ Dirty Phone
                              </span>
                            ) : (
                              <span className="badge green" title="Valid E.164 format">
                                ✓ E.164
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                      <td>
                        {c.city || c.country_code ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                            {c.country_code && (
                              <span className="country-pill">{c.country_code}</span>
                            )}
                            <span style={{ color: "#e2e8f0" }}>{c.city || "—"}</span>
                            {c.country_code && !countryValid && (
                              <span className="badge amber" title="Non-ISO 3166-1 alpha-2 code">
                                Non-ISO
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                      <td>
                        {c.gdpr_consent ? (
                          <span className="badge green" style={{ whiteSpace: "nowrap" }}>
                            <span className="dot ok" style={{ width: 6, height: 6 }} /> Consented
                          </span>
                        ) : (
                          <span className="badge red" title="No GDPR Consent on file" style={{ whiteSpace: "nowrap" }}>
                            <span className="dot bad" style={{ width: 6, height: 6 }} /> Missing
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={c.is_deleted ? "DELETED" : c.status} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            void inspectClient(c.id);
                          }}
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table" id="invoices-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Invoice #</th>
                <th style={{ width: 110 }}>Client ID</th>
                <th style={{ minWidth: 160 }}>Raw Amount String</th>
                <th style={{ minWidth: 170 }}>Standardized Amount</th>
                <th style={{ width: 110 }}>Currency</th>
                <th style={{ minWidth: 170 }}>Invoice Date</th>
                <th style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoicesLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 36 }}>
                    <span className="spinner" /> Loading invoice records…
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No invoice records found in staging database. Click "Seed Dirty CRM Data" in the sidebar!
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className={inv.is_deleted ? "deleted" : undefined}>
                    <td>
                      <span className="mono-chip" style={{ color: "#f8fafc", fontWeight: 700 }}>
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td>
                      <span className="mono-chip">#{shortId(inv.client_id)}</span>
                    </td>
                    <td>
                      <span className="badge gray" style={{ fontFamily: "var(--font-mono)" }}>
                        {inv.amount_raw || "—"}
                      </span>
                    </td>
                    <td>
                      {inv.amount_standardized !== null ? (
                        <span className="badge green">
                          {Number(inv.amount_standardized).toFixed(2)}
                        </span>
                      ) : (
                        <span className="badge amber" title="Requires agent normalization">
                          ⚠ Unstandardized
                        </span>
                      )}
                    </td>
                    <td>
                      {inv.currency ? (
                        <span className="country-pill">{inv.currency}</span>
                      ) : (
                        <span className="cell-dim">—</span>
                      )}
                    </td>
                    <td style={{ color: "#cbd5e1", whiteSpace: "nowrap" }}>{fmtDate(inv.invoice_date)}</td>
                    <td>
                      <StatusBadge status={inv.is_deleted ? "DELETED" : "ACTIVE"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Detail Drawer */}
      <Modal
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        id="client-detail-drawer"
        drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>👤 Client Record Detail</span>
            {selectedClient?.is_deleted && <span className="badge red">Soft Deleted</span>}
          </div>
        }
      >
        {selectedClient && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="card">
              <div className="kv">
                <dt>Full Name:</dt>
                <dd><strong>{selectedClient.full_name}</strong></dd>
                <dt>Email:</dt>
                <dd>{selectedClient.email || "—"}</dd>
                <dt>Phone:</dt>
                <dd>
                  {selectedClient.phone || "—"}{" "}
                  {selectedClient.phone && !isValidPhone(selectedClient.phone) && (
                    <span className="badge amber">Malformed</span>
                  )}
                </dd>
                <dt>Billing Address:</dt>
                <dd>{selectedClient.billing_address || "—"}</dd>
                <dt>Location:</dt>
                <dd>{selectedClient.postal_code || ""} {selectedClient.city || "—"}, {selectedClient.country_code || "—"}</dd>
                <dt>GDPR Consent:</dt>
                <dd>
                  {selectedClient.gdpr_consent ? (
                    <span className="badge green">Granted ({fmtDate(selectedClient.consent_date)})</span>
                  ) : (
                    <span className="badge red">Denied / Missing</span>
                  )}
                </dd>
                <dt>Account Status:</dt>
                <dd><StatusBadge status={selectedClient.status} /></dd>
                <dt>Last Updated:</dt>
                <dd>{fmtDate(selectedClient.updated_at)}</dd>
              </div>
            </div>

            {/* Invoices for this client */}
            <div>
              <h4 style={{ marginBottom: 10, fontSize: 13 }}>
                Associated Invoices ({selectedClient.invoices?.length ?? 0})
              </h4>
              {(selectedClient.invoices || []).length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>
                  No invoices associated with this client.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedClient.invoices.map((inv) => (
                    <div key={inv.id} className="query-card" style={{ padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="mono" style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                        <span>{inv.currency} {inv.amount_standardized ?? inv.amount_raw}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                        Date: {fmtDate(inv.invoice_date)} · Status: {inv.is_deleted ? "Deleted" : "Active"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
