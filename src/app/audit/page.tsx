"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ExecutionDetail, ExecutionSummary } from "@/lib/types";
import { fmtDate, shortId } from "@/lib/format";
import Modal from "@/components/Modal";
import PreImageDiffModal from "@/components/PreImageDiffModal";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

export default function AuditPage() {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollingBack, setRollingBack] = useState(false);

  const toast = useToast();

  const loadExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.executions();
      setExecutions(data);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to load audit history", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadExecutions();
  }, [loadExecutions]);

  const viewDiff = async (executionId: string) => {
    setDetailLoading(true);
    try {
      const detail = await api.execution(executionId);
      setSelectedDetail(detail);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to load execution detail", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirmRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    try {
      const res = await api.rollback(rollbackTarget, rollbackReason || "Operator manual rollback");
      toast(
        `Rollback successful! ${res.restored_rows} rows restored to their original pre-images.`,
        "success"
      );
      setRollbackTarget(null);
      setRollbackReason("");
      setSelectedDetail(null);
      void loadExecutions();
      window.dispatchEvent(new Event("crm:changed"));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Rollback failed", "error");
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Audit Trail & <span className="grad">Deterministic Rollback</span>
          </h1>
          <p className="page-desc">
            Complete cryptographic audit trail of every agent-initiated mutation. Pre-image snapshots stored in governance_db guarantee 100% reversible rollbacks.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn sm" onClick={loadExecutions} disabled={loading}>
            🔄 Refresh Audit Log
          </button>
        </div>
      </div>

      {/* Safety Net Banner */}
      <div className="card" style={{ background: "linear-gradient(90deg, rgba(56, 189, 248, 0.08), rgba(167, 139, 250, 0.04))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 32 }}>🛡️</span>
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Safety Net 2: Pre-Image Snapshot Engine</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
              Before any SQL UPDATE or DELETE statement is committed against staging_db, FastMCP queries matching rows and permanently serializes their exact state into governance_db. Clicking <strong>1-Click Rollback</strong> restores every mutated row in reverse order within an ACID transaction.
            </p>
          </div>
        </div>
      </div>

      {/* Executions Table */}
      <div className="table-wrap">
        <table className="table table-fit" id="audit-executions-table">
          <colgroup>
            <col style={{ width: "95px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "75px" }} />
            <col style={{ width: "115px" }} />
            <col style={{ width: "75px" }} />
            <col style={{ width: "95px" }} />
            <col style={{ width: "135px" }} />
            <col style={{ width: "155px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Goal / Prompt</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Score</th>
              <th>Approved By</th>
              <th style={{ textAlign: "center" }}>Mutated</th>
              <th style={{ textAlign: "center" }}>Pre-Images</th>
              <th>Completed At</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 36 }}>
                  <span className="spinner" /> Loading audit logs…
                </td>
              </tr>
            ) : executions.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  No executions recorded yet. Run a prompt in the Agent Cockpit to view audit entries.
                </td>
              </tr>
            ) : (
              executions.map((ex) => (
                <tr key={ex.execution_id}>
                  <td>
                    <span className="mono-chip" title={ex.execution_id} style={{ fontSize: "11px", padding: "2px 6px" }}>
                      #{shortId(ex.execution_id)}
                    </span>
                  </td>
                  <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span
                      title={ex.master_goal}
                      style={{ fontWeight: 500, color: "#f8fafc", fontSize: "13px" }}
                    >
                      {ex.master_goal}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={ex.status} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {ex.judge_score !== null ? (
                      <span className="badge green" style={{ padding: "2px 7px" }}>
                        {ex.judge_score.toFixed(2)}
                      </span>
                    ) : (
                      <span className="cell-dim">—</span>
                    )}
                  </td>
                  <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ex.approved_by ? (
                      <span style={{ fontSize: "12px", color: "#e2e8f0" }} title={ex.approved_by}>
                        {ex.approved_by}
                      </span>
                    ) : (
                      <span className="badge gray" style={{ fontSize: "10.5px", padding: "2px 6px" }}>
                        Automated
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="badge violet" style={{ fontWeight: 600, padding: "2px 7px" }}>
                      {ex.affected_rows ?? 0}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="badge cyan" style={{ whiteSpace: "nowrap", padding: "2px 7px" }}>
                      {ex.pre_images_captured} rows
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "11.5px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {fmtDate(ex.completed_at)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 5, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-table-action"
                        style={{ padding: "4px 9px", fontSize: "11.5px" }}
                        onClick={() => viewDiff(ex.execution_id)}
                        disabled={detailLoading}
                      >
                        Inspect
                      </button>
                      {ex.can_rollback && (
                        <button
                          type="button"
                          className="btn sm danger"
                          style={{ padding: "4px 8px", fontSize: "11.5px" }}
                          onClick={() => setRollbackTarget(ex.execution_id)}
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pre-Image State Diff Modal */}
      <PreImageDiffModal
        execution={selectedDetail}
        open={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        onRollback={(id) => {
          setRollbackTarget(id);
        }}
      />

      {/* Rollback Confirmation Modal */}
      <Modal
        open={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        id="rollback-confirm-modal"
        title="⚠️ Confirm 1-Click Rollback"
        locked={rollingBack}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <button
              type="button"
              className="btn sm"
              disabled={rollingBack}
              onClick={() => setRollbackTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-confirm-rollback"
              className="btn danger"
              disabled={rollingBack}
              onClick={handleConfirmRollback}
            >
              {rollingBack ? <span className="spinner" /> : "Revert Staging to Pre-Image State"}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0 }}>
            You are about to invoke the deterministic rollback engine on execution <span className="mono">{rollbackTarget}</span>.
          </p>
          <div className="alert danger-zone">
            All rows modified by this batch will be restored to their exact pre-image snapshots captured in governance_db.
          </div>
          <div>
            <label htmlFor="rollback-reason-input" className="field-label">
              Reason for rollback (logged in audit trail):
            </label>
            <input
              id="rollback-reason-input"
              className="input"
              placeholder="e.g., Client requested rollback / incorrect standardization"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
