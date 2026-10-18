"use client";

import type { ExecutionDetail, RowDiff } from "@/lib/types";
import { fmtDate, pretty } from "@/lib/format";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import SqlViewer from "./SqlViewer";

interface PreImageDiffModalProps {
  execution: ExecutionDetail | null;
  open: boolean;
  onClose: () => void;
  onRollback?: (executionId: string) => void;
  rollingBack?: boolean;
}

export default function PreImageDiffModal({
  execution,
  open,
  onClose,
  onRollback,
  rollingBack,
}: PreImageDiffModalProps) {
  if (!execution) return null;

  const diffs: RowDiff[] = execution.diffs ?? [];
  const queries = execution.queries ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      id="pre-image-diff-modal"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>🛡️ Execution Audit & State Diff</span>
          <StatusBadge status={execution.status} />
        </div>
      }
      footer={
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Execution ID: <span className="mono">{execution.execution_id}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {execution.can_rollback && onRollback && (
              <button
                type="button"
                className="btn danger"
                disabled={rollingBack}
                onClick={() => onRollback(execution.execution_id)}
              >
                {rollingBack ? <span className="spinner" /> : "↺ 1-Click Rollback"}
              </button>
            )}
            <button type="button" className="btn sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      }
    >
      {/* High-level execution stats */}
      <div className="card">
        <div className="kv">
          <dt>Master Goal:</dt>
          <dd><strong>{execution.master_goal}</strong></dd>
          <dt>Approved By:</dt>
          <dd>{execution.approved_by || "Automated/Pending"} ({fmtDate(execution.approved_at)})</dd>
          <dt>Query Nature:</dt>
          <dd>
            {execution.is_read_only || (execution.affected_rows === 0 && (execution.query_results?.length ?? 0) > 0) ? (
              <span className="badge green">Read-Only Query (0 Mutations)</span>
            ) : (
              <span className="badge violet">Data Transformation / Mutation</span>
            )}
          </dd>
          <dt>Rows Mutated:</dt>
          <dd>{execution.affected_rows ?? 0}</dd>
          <dt>Pre-Images Saved:</dt>
          <dd>{execution.pre_images_captured} rows snapshotted into governance_db</dd>
          {execution.query_results && execution.query_results.length > 0 && (
            <>
              <dt>Records Retrieved:</dt>
              <dd>
                <strong style={{ color: "var(--cyan)" }}>{execution.query_results.length} record(s) fetched</strong>
              </dd>
            </>
          )}
          <dt>Judge Feedback:</dt>
          <dd>{execution.judge_feedback || "None"}</dd>
        </div>
      </div>

      {/* Plan Queries */}
      {queries.length > 0 && (
        <div>
          <h4 style={{ marginBottom: 8, fontSize: 13, color: "var(--text-dim)" }}>
            Executed SQL Statements ({queries.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {queries.map((q, i) => (
              <SqlViewer key={i} sql={q.sql_statement} />
            ))}
          </div>
        </div>
      )}

      {/* Retrieved Records for Read-Only / Information Queries */}
      {execution.query_results && execution.query_results.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>📋 Retrieved Records / Query Output</span>
              <span className="badge cyan">{execution.query_results.length} returned</span>
            </h4>
            <span className="badge green">Safe Read-Only Query</span>
          </div>

          <div className="card" style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.25)", overflow: "hidden", padding: 0 }}>
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="table" style={{ margin: 0, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(30, 41, 59, 0.7)" }}>
                    {Object.keys(execution.query_results[0]).map((col) => (
                      <th key={col} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {execution.query_results.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      {Object.entries(row).map(([col, val]) => (
                        <td key={col} style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          {typeof val === "boolean" ? (
                            <span className={`badge ${val ? "green" : "red"}`}>{String(val)}</span>
                          ) : val === null || val === undefined ? (
                            <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>null</span>
                          ) : (
                            <span className={col.includes("id") || col.includes("email") ? "mono" : ""}>
                              {String(val)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Image Diffs */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontSize: 14 }}>
            Row Pre-Image State Diffs ({diffs.length})
          </h4>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Red = Pre-Mutation (Captured) · Green = Current Staging Value
          </span>
        </div>

        {diffs.length === 0 ? (
          <div className="empty" style={{ padding: "24px 16px" }}>
            <div className="empty-icon" style={{ fontSize: 28, marginBottom: 8 }}>
              {execution.query_results && execution.query_results.length > 0 ? "✓" : "🔍"}
            </div>
            <p style={{ margin: 0 }}>
              {execution.query_results && execution.query_results.length > 0
                ? "Read-only query: 0 database mutations performed (no pre-image snapshots or rollback needed)."
                : "No row-level pre-images recorded for this execution (read-only query or 0 rows matched)."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {diffs.map((d) => {
              const allKeys = Array.from(
                new Set([...Object.keys(d.before || {}), ...Object.keys(d.after || {})])
              );
              return (
                <div key={d.pre_image_id} className="query-card" style={{ background: "rgba(15, 21, 36, 0.7)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge violet">{d.target_table}</span>
                      <span className="mono" style={{ fontSize: 12 }}>PK: {d.primary_key_value}</span>
                    </div>
                    <span className="badge amber">{d.changed_fields.length} fields modified</span>
                  </div>

                  <div className="table-wrap" style={{ marginTop: 6 }}>
                    <table className="diff-table">
                      <thead>
                        <tr>
                          <th style={{ width: "25%" }}>Field</th>
                          <th style={{ width: "37.5%" }}>Pre-Image State (Captured Before)</th>
                          <th style={{ width: "37.5%" }}>Staging State (After Mutation)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allKeys.map((k) => {
                          const isChanged = d.changed_fields.includes(k);
                          return (
                            <tr key={k} className={isChanged ? "changed" : undefined}>
                              <td style={{ fontWeight: isChanged ? 600 : 400, color: isChanged ? "var(--cyan)" : "inherit" }}>
                                {k}
                              </td>
                              <td className={isChanged ? "diff-before" : ""}>
                                {pretty(d.before?.[k])}
                              </td>
                              <td className={isChanged ? "diff-after" : ""}>
                                {d.after ? pretty(d.after[k]) : <span style={{ color: "var(--text-faint)" }}>[Deleted]</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
