"use client";

import { useState } from "react";
import type { PendingApproval } from "@/lib/types";
import Modal from "./Modal";
import ScoreGauge from "./ScoreGauge";
import SqlViewer from "./SqlViewer";

interface HitlApprovalModalProps {
  pending: PendingApproval | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export default function HitlApprovalModal({
  pending,
  open,
  onClose,
  onApprove,
  onReject,
}: HitlApprovalModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!pending) return null;

  const { proposed_plan, judge_evaluation, plan_hash } = pending;
  const queries = proposed_plan?.queries ?? [];

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setBusy(true);
    try {
      await onReject(rejectionReason);
      setRejecting(false);
      setRejectionReason("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      id="hitl-approval-modal"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>🧑‍💼 Human-in-the-Loop Approval Gate</span>
          <span className="badge amber">Signature Required</span>
        </div>
      }
      locked={busy}
      footer={
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Cryptographic Token: <span className="mono">{pending.approval_token.slice(0, 16)}…</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {rejecting ? (
              <>
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy}
                  onClick={() => setRejecting(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-reject"
                  className="btn sm danger"
                  disabled={busy || !rejectionReason.trim()}
                  onClick={handleReject}
                >
                  {busy ? <span className="spinner" /> : "Confirm Rejection"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-reject-plan"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  Reject Plan
                </button>
                <button
                  type="button"
                  id="btn-approve-sign"
                  className="btn primary"
                  disabled={busy}
                  onClick={handleApprove}
                >
                  {busy ? <span className="spinner" /> : "✓ Approve & Sign Execution"}
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="hitl-banner">
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <strong>Deterministic Execution Gate:</strong> The agent cannot execute queries on the database without an explicit human digital signature. Review the plan and judge evaluation below.
        </div>
      </div>

      {rejecting && (
        <div className="alert error">
          <label htmlFor="rejection-reason" className="field-label" style={{ color: "#fda4af" }}>
            Reason for rejection (will be fed back to agent if re-attempted):
          </label>
          <textarea
            id="rejection-reason"
            className="textarea"
            rows={2}
            placeholder="e.g., Query touches wrong table or does not respect privacy standards..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      )}

      {/* Plan Details & Hash */}
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <span>📋 Proposed SQL Plan</span>
            <span className="badge cyan">Simulated: {proposed_plan?.simulated_affected_rows ?? 0} rows</span>
          </div>
          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-dim)" }}>
            {proposed_plan?.summary || "No summary provided"}
          </p>
          <div className="kv">
            <dt>Target Tables:</dt>
            <dd>
              {(proposed_plan?.targeted_tables || []).map((t) => (
                <span key={t} className="badge gray" style={{ marginRight: 4 }}>
                  {t}
                </span>
              ))}
            </dd>
            <dt>Plan SHA-256:</dt>
            <dd className="hash">{plan_hash}</dd>
            <dt>Read Only:</dt>
            <dd>{proposed_plan?.is_read_only ? "Yes" : "No (Mutating Batch)"}</dd>
          </div>
        </div>

        {/* Judge Score & Evaluation */}
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <ScoreGauge score={judge_evaluation?.score ?? null} label="Judge Score" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Verdict:</div>
              <span className={`badge ${judge_evaluation?.passed ? "green" : "red"}`}>
                {judge_evaluation?.verdict ?? "PENDING"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", maxHeight: 80, overflowY: "auto" }}>
              {judge_evaluation?.feedback || "No feedback from judge agent."}
            </div>
            {judge_evaluation?.detected_violations?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 600 }}>Violations:</div>
                <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 11.5, color: "#fda4af" }}>
                  {judge_evaluation.detected_violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SQL Queries */}
      <div>
        <h4 style={{ marginBottom: 10, fontSize: 14 }}>Generated SQL Statements ({queries.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {queries.map((q, idx) => (
            <div key={idx} className="query-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="badge violet">{q.operation}</span>
                  <span className="badge gray">{q.target_table}</span>
                </div>
                <span className={`badge ${q.is_safe ? "green" : "red"}`}>
                  {q.is_safe ? "AST Verified" : "Flagged Unsafe"}
                </span>
              </div>
              <SqlViewer sql={q.sql_statement} />
              {q.rationale && (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  <em>Rationale:</em> {q.rationale}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
