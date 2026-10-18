"use client";

import Link from "next/link";
import { useState } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import AgentPipelineFlow from "@/components/AgentPipelineFlow";
import HitlApprovalModal from "@/components/HitlApprovalModal";
import ScoreGauge from "@/components/ScoreGauge";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const PRESET_PROMPTS = [
  {
    label: "📞 Standardize German Phone Numbers",
    prompt:
      "Standardize all German client phone numbers in the CRM database to E.164 international format (+49...). Remove leading zeros and format consistently.",
  },
  {
    label: "🛡️ Enforce GDPR Article 17 Consent",
    prompt:
      "Identify clients without GDPR consent (gdpr_consent = false) and perform a compliant soft-delete on their accounts and associated invoices.",
  },
  {
    label: "💶 Standardize Invoice Currencies",
    prompt:
      "Parse the raw currency strings in staging invoices and calculate standardized numeric amounts in EUR for all pending invoices.",
  },
  {
    label: "🌍 Normalize Country Codes",
    prompt:
      "Standardize full country names (e.g., 'Germany', 'Deutschland') in client records to 2-letter ISO alpha-2 codes (DE).",
  },
];

export default function AgentCockpitPage() {
  const [prompt, setPrompt] = useState("");
  const { state, start, approve, reject, reset } = usePipeline();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const toast = useToast();

  const isRunning =
    state.phase === "starting" ||
    state.phase === "running" ||
    state.phase === "executing";

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    try {
      await start(prompt);
      toast("Agent pipeline dispatched. Listening for SSE events...", "info");
    } catch {
      toast("Failed to dispatch pipeline", "error");
    }
  };

  const handleApprove = async () => {
    try {
      const res = await approve();
      toast(
        `Plan approved & executed! ${res?.total_affected_rows ?? 0} rows mutated with full pre-image snapshots.`,
        "success"
      );
      window.dispatchEvent(new Event("crm:changed"));
    } catch {
      toast("Execution failed", "error");
    }
  };

  const handleReject = async (reason: string) => {
    try {
      await reject(reason);
      toast("Execution plan rejected by human operator.", "info");
    } catch {
      toast("Failed to reject plan", "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            AI Agent <span className="grad">Cockpit</span>
          </h1>
          <p className="page-desc">
            Governed autonomous multi-agent pipeline with Presidio PII masking, LLM Judge safety scoring, and deterministic Human-in-the-Loop cryptographic gates.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {state.phase !== "idle" && (
            <button
              type="button"
              id="btn-reset-pipeline"
              className="btn sm"
              onClick={reset}
              disabled={isRunning}
            >
              Reset Session
            </button>
          )}
          <Link href="/audit" className="btn sm">
            📜 View Audit History
          </Link>
        </div>
      </div>

      {/* Main Execution Flow Bar */}
      <div className="card">
        <div className="card-title">
          <span>⚡ Multi-Agent Execution Lifecycle</span>
          <span className="card-sub">
            {state.threadId ? (
              <span className="mono">Thread: {state.threadId.slice(0, 8)}…</span>
            ) : (
              "Idle"
            )}
          </span>
        </div>
        <AgentPipelineFlow state={state} />
      </div>

      {/* Human-in-the-Loop Banner Alert when paused */}
      {state.phase === "awaiting_approval" && (
        <div className="hitl-banner" style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Human Approval Gate Triggered</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Plan drafted with {state.queryCount ?? 1} SQL queries. Judge score: {state.judgeScore?.toFixed(2) ?? "—"}. Execution is halted awaiting your signature.
              </div>
            </div>
          </div>
          <button
            type="button"
            id="btn-open-approval-gate"
            className="btn primary"
            onClick={() => setShowApprovalModal(true)}
          >
            Review & Sign Plan →
          </button>
        </div>
      )}

      {/* Result Card when completed */}
      {state.phase === "completed" && state.result && (
        <div className="card" style={{ borderColor: "rgba(34, 197, 94, 0.4)", background: "rgba(34, 197, 94, 0.05)" }}>
          <div className="card-title" style={{ color: "var(--emerald)" }}>
            <span>✓ Execution Completed Successfully</span>
            <span className="badge green">Safe & Reversible</span>
          </div>
          <div className="kv" style={{ marginBottom: 14 }}>
            <dt>Execution ID:</dt>
            <dd className="mono">{state.result.execution_id}</dd>
            <dt>Query Nature:</dt>
            <dd>
              {(state.result.query_results?.length ?? 0) > 0 || state.result.total_affected_rows === 0 ? (
                <span className="badge green">Safe Read-Only Query</span>
              ) : (
                <span className="badge violet">Data Mutation</span>
              )}
            </dd>
            <dt>Rows Mutated:</dt>
            <dd><strong>{state.result.total_affected_rows}</strong></dd>
            <dt>Pre-Images Saved:</dt>
            <dd>{state.result.pre_images_captured} rows in governance_db (100% reversible)</dd>
            {state.result.payload_s3_uri && (
              <>
                <dt>MinIO Payload:</dt>
                <dd className="mono" style={{ fontSize: 11 }}>{state.result.payload_s3_uri}</dd>
              </>
            )}
          </div>

          {/* Retrieved Records Display for Informational Queries */}
          {state.result.query_results && state.result.query_results.length > 0 && (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: "var(--cyan)" }}>
                  📋 Retrieved Records ({state.result.query_results.length}):
                </strong>
                <span className="badge cyan">Live CRM Data</span>
              </div>
              <div className="card" style={{ background: "rgba(15, 23, 42, 0.7)", padding: 0, overflow: "hidden", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                <div className="table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
                  <table className="table" style={{ margin: 0, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "rgba(30, 41, 59, 0.7)" }}>
                        {Object.keys(state.result.query_results[0]).map((col) => (
                          <th key={col} style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.result.query_results.map((row, idx) => (
                        <tr key={idx}>
                          {Object.entries(row).map(([col, val]) => (
                            <td key={col} style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                              {typeof val === "boolean" ? (
                                <span className={`badge ${val ? "green" : "red"}`}>{String(val)}</span>
                              ) : val === null || val === undefined ? (
                                <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>null</span>
                              ) : (
                                <span className={col.includes("id") || col.includes("email") ? "mono" : ""}>{String(val)}</span>
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

          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/crm" className="btn sm primary">
              Inspect Cleaned CRM Records →
            </Link>
            <Link href="/audit" className="btn sm">
              View Pre-Image Diff & Audit Trail →
            </Link>
          </div>
        </div>
      )}

      {/* Error state */}
      {state.phase === "failed" && (
        <div className="alert error">
          <strong>Pipeline Failed:</strong> {state.error}
        </div>
      )}

      {/* Input Prompt & Presets */}
      <div className="grid cols-3">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-title">
            <span>💬 Compliance Directive Prompt</span>
            <span className="card-sub">Presidio PII Redaction Active</span>
          </div>
          <form onSubmit={handleRun}>
            <textarea
              id="prompt-input"
              className="textarea"
              rows={4}
              placeholder="Give the AI agent a data cleaning or compliance goal (e.g., 'Clean all phone numbers in the CRM to E.164 international format')..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isRunning}
            />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Pressing Run invokes Guardrail → Planner → FastMCP Dry Run → Judge
              </span>
              <button
                type="submit"
                id="btn-run-pipeline"
                className="btn primary"
                disabled={isRunning || !prompt.trim()}
              >
                {isRunning ? (
                  <>
                    <span className="spinner" /> Processing Agent Graph…
                  </>
                ) : (
                  "🚀 Execute Directive"
                )}
              </button>
            </div>
          </form>

          <div style={{ marginTop: 20 }}>
            <span className="field-label">Sample Enterprise Compliance Presets:</span>
            <div className="chips">
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  id={`preset-chip-${idx}`}
                  className="chip"
                  disabled={isRunning}
                  onClick={() => setPrompt(p.prompt)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Metrics & Judge Score Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card-title">
            <span>📊 Live Telemetry</span>
            <StatusBadge status={state.phase} />
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <ScoreGauge score={state.judgeScore} label="Judge Score" />
          </div>

          <div className="kv" style={{ fontSize: 12.5 }}>
            <dt>PII Redacted:</dt>
            <dd>
              {state.piiCount > 0 ? (
                <span className="badge amber">{state.piiCount} entities</span>
              ) : (
                <span className="badge green">0 detected</span>
              )}
            </dd>
            <dt>Replan Attempts:</dt>
            <dd>{state.attempts} / 3 max</dd>
            <dt>Judge Verdict:</dt>
            <dd>
              {state.verdict ? (
                <span className={`badge ${state.verdict.includes("PASS") ? "green" : "red"}`}>
                  {state.verdict}
                </span>
              ) : (
                <span className="cell-dim">Pending</span>
              )}
            </dd>
          </div>

          {state.sanitizedPreview && (
            <div style={{ background: "rgba(11, 15, 25, 0.7)", padding: 10, borderRadius: 8, fontSize: 11 }}>
              <div style={{ color: "var(--text-faint)", marginBottom: 4 }}>Presidio Sanitized Preview:</div>
              <div className="mono" style={{ color: "var(--cyan)", wordBreak: "break-word" }}>
                {state.sanitizedPreview}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Event Log */}
      <div className="card">
        <div className="card-title">
          <span>📡 Live Agent Event Stream (SSE)</span>
          <span className="badge gray">{state.events.length} events received</span>
        </div>
        {state.events.length === 0 ? (
          <div className="empty" style={{ padding: "24px 0" }}>
            <p>No active event stream. Enter a directive above to watch the agent reasoning pipeline.</p>
          </div>
        ) : (
          <div className="log" id="event-stream-log">
            {state.events.map((ev, i) => (
              <div key={i} className="log-line">
                <span className="log-time">
                  {new Date(ev.at).toLocaleTimeString()}
                </span>
                <span className="log-ev">[{ev.event}]</span>
                <span style={{ color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {JSON.stringify(ev.data)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Human-in-the-Loop review */}
      <HitlApprovalModal
        open={showApprovalModal || state.phase === "awaiting_approval"}
        pending={state.pending}
        onClose={() => setShowApprovalModal(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  );
}
