"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { RetentionStats } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

export default function GovernancePage() {
  const [retentionDays, setRetentionDays] = useState(30);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Purge state
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  // GDPR Hard Delete state
  const [clientId, setClientId] = useState("");
  const [hardDeleting, setHardDeleting] = useState(false);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);

  const toast = useToast();

  const loadRetentionStats = useCallback(async (days: number) => {
    setStatsLoading(true);
    try {
      const res = await api.retentionStats(days);
      setStats(res);
    } catch {
      /* ignore */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRetentionStats(retentionDays);
  }, [loadRetentionStats, retentionDays]);

  const handleRunPurge = async () => {
    setPurging(true);
    try {
      const res = await api.purge(retentionDays);
      setPurgeResult(
        `Purge Completed: ${res.total_purged_rows} rows purged (${res.purged_clients} clients, ${res.purged_invoices} invoices) older than ${res.retention_days} days.`
      );
      toast(`Purged ${res.total_purged_rows} expired records.`, "success");
      void loadRetentionStats(retentionDays);
      window.dispatchEvent(new Event("crm:changed"));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Retention purge failed", "error");
    } finally {
      setPurging(false);
    }
  };

  const handleHardDelete = async () => {
    if (!clientId.trim()) return;
    setHardDeleting(true);
    try {
      await api.hardDelete(clientId.trim());
      toast(`Client ${clientId} and associated records permanently deleted.`, "success");
      setClientId("");
      setShowHardDeleteModal(false);
      void loadRetentionStats(retentionDays);
      window.dispatchEvent(new Event("crm:changed"));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Hard delete failed", "error");
    } finally {
      setHardDeleting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Compliance & <span className="grad">GDPR Governance</span>
          </h1>
          <p className="page-desc">
            Enforce GDPR Article 17 "Right to be Forgotten", data lifecycle retention policies, and immutable object storage compliance offloading.
          </p>
        </div>
      </div>

      {/* Retention Policy Panel */}
      <div className="card">
        <div className="card-title">
          <span>⏳ Automated Retention & Expired Record Purge</span>
          <span className="badge cyan">GDPR Art. 5(1)(e)</span>
        </div>
        <p style={{ margin: "0 0 16px 0", color: "var(--text-dim)", fontSize: 13 }}>
          Records that were soft-deleted more than <strong>{retentionDays} days</strong> ago become eligible for permanent deletion to satisfy data minimization mandates.
        </p>

        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <div className="stat" style={{ "--accent": "var(--cyan)" } as React.CSSProperties}>
            <span className="stat-label">Retention Horizon</span>
            <span className="stat-value">{retentionDays} Days</span>
            <span className="stat-hint">Cutoff: {fmtDate(stats?.cutoff_timestamp)}</span>
          </div>
          <div className="stat" style={{ "--accent": "var(--amber)" } as React.CSSProperties}>
            <span className="stat-label">Soft-Deleted Clients</span>
            <span className="stat-value">{stats?.soft_deleted_clients ?? 0}</span>
            <span className="stat-hint">Flagged is_deleted=true</span>
          </div>
          <div className="stat" style={{ "--accent": "var(--violet)" } as React.CSSProperties}>
            <span className="stat-label">Soft-Deleted Invoices</span>
            <span className="stat-value">{stats?.soft_deleted_invoices ?? 0}</span>
            <span className="stat-hint">Associated invoice records</span>
          </div>
          <div className="stat" style={{ "--accent": "var(--red)" } as React.CSSProperties}>
            <span className="stat-label">Purge Eligible</span>
            <span className="stat-value" style={{ color: "var(--red)" }}>
              {(stats?.purge_eligible_clients ?? 0) + (stats?.purge_eligible_invoices ?? 0)}
            </span>
            <span className="stat-hint">Passed {retentionDays}-day threshold</span>
          </div>
        </div>

        <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
          <div>
            <label htmlFor="retention-days-input" className="field-label">
              Adjust Retention Threshold (Days):
            </label>
            <input
              id="retention-days-input"
              type="number"
              min={0}
              max={365}
              className="input"
              style={{ width: 140 }}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            id="btn-run-retention-purge"
            className="btn warn"
            disabled={purging || statsLoading}
            onClick={handleRunPurge}
          >
            {purging ? <span className="spinner" /> : "🧹 Run Automated Retention Purge"}
          </button>
        </div>

        {purgeResult && (
          <div className="alert info" style={{ marginTop: 14 }}>
            {purgeResult}
          </div>
        )}
      </div>

      {/* GDPR Article 17 Hard Delete */}
      <div className="card" style={{ borderColor: "rgba(244, 63, 94, 0.3)" }}>
        <div className="card-title" style={{ color: "#fda4af" }}>
          <span>🗑️ GDPR Article 17: Right to be Forgotten Console</span>
          <span className="badge red">Permanent & Irreversible</span>
        </div>
        <p style={{ margin: "0 0 16px 0", color: "var(--text-dim)", fontSize: 13 }}>
          Hard delete irrevocably purges a data subject&apos;s record and cascades to all associated business invoices in staging_db. This operation bypasses soft-deletion flags.
        </p>

        <div className="row" style={{ gap: 14 }}>
          <input
            id="gdpr-client-id-input"
            className="input"
            style={{ maxWidth: 420 }}
            placeholder="Paste client UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)..."
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <button
            type="button"
            id="btn-trigger-hard-delete"
            className="btn danger"
            disabled={!clientId.trim()}
            onClick={() => setShowHardDeleteModal(true)}
          >
            Execute Permanent Hard Delete
          </button>
        </div>
      </div>

      {/* Infrastructure & Compliance Details */}
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <span>🪣 Immutable Object Storage (MinIO S3)</span>
          </div>
          <div className="kv">
            <dt>Bucket:</dt>
            <dd className="mono">governance-payloads</dd>
            <dt>Threshold:</dt>
            <dd>Payloads &gt; 5KB automatically offloaded to MinIO</dd>
            <dt>Payload Format:</dt>
            <dd>Zstandard / JSON compressed with SHA-256 integrity hash</dd>
            <dt>Storage Tier:</dt>
            <dd>Local S3 API compatible (port 9000)</dd>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>🛡️ Presidio PII Guardrail Policy</span>
          </div>
          <div className="kv">
            <dt>Supported Entities:</dt>
            <dd>EMAIL, PHONE_NUMBER, IBAN, PERSON, LOCATION, IP_ADDRESS</dd>
            <dt>Anonymization:</dt>
            <dd>Cryptographic pseudorandom hashing / mask tags</dd>
            <dt>AST Engine:</dt>
            <dd>sqlglot Postgres Dialect with AST query verification</dd>
            <dt>Judge LLM:</dt>
            <dd>openai/gpt-oss-120b on Groq</dd>
          </div>
        </div>
      </div>

      {/* Hard Delete Confirmation Modal */}
      <Modal
        open={showHardDeleteModal}
        onClose={() => setShowHardDeleteModal(false)}
        id="hard-delete-confirm-modal"
        title="⚠️ Confirm Permanent GDPR Hard Delete"
        locked={hardDeleting}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <button
              type="button"
              className="btn sm"
              disabled={hardDeleting}
              onClick={() => setShowHardDeleteModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-confirm-hard-delete"
              className="btn danger"
              disabled={hardDeleting}
              onClick={handleHardDelete}
            >
              {hardDeleting ? <span className="spinner" /> : "Permanently Delete Data Subject"}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0 }}>
            You are about to irreversibly purge client record <span className="mono">{clientId}</span> from the database.
          </p>
          <div className="alert danger-zone">
            This action deletes the client record AND cascades to all invoices belonging to this client. This action CANNOT be undone by 1-Click Rollback.
          </div>
        </div>
      </Modal>
    </>
  );
}
