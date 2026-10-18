import type { PipelineState, StageKey, StageStatus } from "@/hooks/usePipeline";

const STAGES: { key: StageKey; name: string; icon: string }[] = [
  { key: "guardrail", name: "PII Guardrail", icon: "🔒" },
  { key: "planner", name: "SQL Planner", icon: "🧩" },
  { key: "judge", name: "LLM Judge", icon: "⚖️" },
  { key: "hitl", name: "Human Approval", icon: "🧑‍💼" },
  { key: "execution", name: "Sandbox Execution", icon: "🚀" },
];

function meta(key: StageKey, s: PipelineState, status: StageStatus): string {
  if (status === "idle") return "Waiting";
  switch (key) {
    case "guardrail":
      return status === "active" ? "Scanning prompt…" : `${s.piiCount} PII entities masked`;
    case "planner":
      if (status === "active") return s.attempts ? `Re-planning (attempt ${s.attempts + 1}/3)` : "Drafting SQL…";
      return `${s.queryCount ?? 0} queries · attempt ${s.attempts}/3`;
    case "judge":
      if (status === "active") return "Evaluating safety…";
      return s.judgeScore !== null ? `Score ${s.judgeScore.toFixed(2)} · ${s.verdict ?? ""}` : "";
    case "hitl":
      return status === "waiting" ? "Awaiting your signature" : status === "error" ? "Rejected" : "Signed";
    case "execution":
      return status === "active"
        ? "Snapshotting pre-images…"
        : status === "done"
        ? `${s.result?.total_affected_rows ?? 0} rows · ${s.result?.pre_images_captured ?? 0} pre-images`
        : "Failed";
  }
}

export default function AgentPipelineFlow({ state }: { state: PipelineState }) {
  return (
    <div className="flow" id="pipeline-flow" role="list" aria-label="Agent pipeline progress">
      {STAGES.map((st) => {
        const status = state.stages[st.key];
        return (
          <div key={st.key} className={`stage ${status}`} role="listitem" id={`stage-${st.key}`} data-status={status}>
            <div className="stage-node" aria-hidden>{status === "done" ? "✓" : status === "error" ? "✕" : st.icon}</div>
            <div className="stage-name">{st.name}</div>
            <div className="stage-meta">{meta(st.key, state, status)}</div>
          </div>
        );
      })}
    </div>
  );
}
