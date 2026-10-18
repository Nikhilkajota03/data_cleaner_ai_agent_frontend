"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, streamUrl } from "@/lib/api";
import type {
  ApproveResponse,
  PendingApproval,
  PipelineEvent,
  PipelineEventName,
} from "@/lib/types";

const EVENT_NAMES: PipelineEventName[] = [
  "pipeline_started",
  "node_guardrail_completed",
  "node_planner_completed",
  "node_judge_completed",
  "hitl_paused",
  "completed",
  "failed",
  "rejected",
  "rolled_back",
];

const TERMINAL: PipelineEventName[] = ["hitl_paused", "completed", "failed", "rejected", "rolled_back"];

export type StageKey = "guardrail" | "planner" | "judge" | "hitl" | "execution";
export type StageStatus = "idle" | "active" | "done" | "error" | "waiting";

export type RunPhase =
  | "idle"
  | "starting"
  | "running"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

export interface PipelineState {
  phase: RunPhase;
  threadId: string | null;
  events: PipelineEvent[];
  stages: Record<StageKey, StageStatus>;
  attempts: number;
  piiCount: number;
  sanitizedPreview: string | null;
  queryCount: number | null;
  planSummary: string | null;
  judgeScore: number | null;
  verdict: string | null;
  pending: PendingApproval | null;
  result: ApproveResponse | null;
  error: string | null;
}

const initial: PipelineState = {
  phase: "idle",
  threadId: null,
  events: [],
  stages: { guardrail: "idle", planner: "idle", judge: "idle", hitl: "idle", execution: "idle" },
  attempts: 0,
  piiCount: 0,
  sanitizedPreview: null,
  queryCount: null,
  planSummary: null,
  judgeScore: null,
  verdict: null,
  pending: null,
  result: null,
  error: null,
};

/** Drives a full pipeline run: POST /run -> SSE stream -> HITL pending -> approve/reject. */
export function usePipeline(approverId = "compliance.officer@enterprise.local") {
  const [state, setState] = useState<PipelineState>(initial);
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const apply = useCallback((ev: PipelineEvent) => {
    setState((s) => {
      const next: PipelineState = { ...s, events: [...s.events, ev], stages: { ...s.stages } };
      const d = ev.data ?? {};
      const sum = d.summary ?? {};
      switch (ev.event) {
        case "pipeline_started":
          next.phase = "running";
          next.stages.guardrail = "active";
          break;
        case "node_guardrail_completed":
          next.stages.guardrail = "done";
          next.stages.planner = "active";
          next.piiCount = sum.pii_detected_count ?? s.piiCount;
          next.sanitizedPreview = sum.sanitized_preview ?? s.sanitizedPreview;
          break;
        case "node_planner_completed":
          next.attempts = s.attempts + 1;
          next.stages.planner = "done";
          next.stages.judge = "active";
          next.queryCount = sum.query_count ?? s.queryCount;
          next.planSummary = sum.plan_summary ?? s.planSummary;
          break;
        case "node_judge_completed": {
          next.judgeScore = typeof sum.score === "number" ? sum.score : s.judgeScore;
          next.verdict = sum.verdict ?? s.verdict;
          const rejected = String(sum.verdict ?? "").toUpperCase().includes("REJECT");
          // A rejected plan loops back to the planner (re-plan).
          next.stages.judge = rejected ? "error" : "done";
          if (rejected) next.stages.planner = "active";
          break;
        }
        case "hitl_paused":
          next.phase = "awaiting_approval";
          next.stages.planner = "done";
          next.stages.judge = "done";
          next.stages.hitl = "waiting";
          next.judgeScore = d.judge_score ?? s.judgeScore;
          break;
        case "completed":
          next.phase = "completed";
          next.stages.hitl = "done";
          next.stages.execution = "done";
          break;
        case "failed":
          next.phase = "failed";
          next.error = d.error ?? "Pipeline failed";
          (Object.keys(next.stages) as StageKey[]).forEach((k) => {
            if (next.stages[k] === "active") next.stages[k] = "error";
          });
          break;
        case "rejected":
          next.phase = "rejected";
          next.stages.hitl = "error";
          break;
      }
      return next;
    });
  }, []);

  const loadPending = useCallback(async (threadId: string) => {
    try {
      const pending = await api.pending(threadId);
      setState((s) => ({ ...s, pending }));
    } catch (e) {
      setState((s) => ({
        ...s,
        phase: "failed",
        error: e instanceof ApiError ? e.message : "Could not load the pending plan",
      }));
    }
  }, []);

  const start = useCallback(
    async (prompt: string) => {
      closeStream();
      setState({ ...initial, phase: "starting" });
      try {
        const run = await api.runPipeline(prompt);
        setState((s) => ({ ...s, threadId: run.thread_id, piiCount: run.detected_pii_count }));

        const es = new EventSource(streamUrl(run.thread_id));
        sourceRef.current = es;
        EVENT_NAMES.forEach((name) => {
          es.addEventListener(name, (msg) => {
            let data: Record<string, any> = {};
            try {
              data = JSON.parse((msg as MessageEvent).data);
            } catch {
              /* keep-alive or non-JSON payload */
            }
            apply({ event: name, data, at: Date.now() });
            if (name === "hitl_paused") void loadPending(run.thread_id);
            if (TERMINAL.includes(name)) closeStream();
          });
        });
        es.onerror = () => {
          // EventSource auto-reconnects on transient errors; a closed stream means we finished.
          if (es.readyState === EventSource.CLOSED) closeStream();
        };
      } catch (e) {
        setState((s) => ({
          ...s,
          phase: "failed",
          error: e instanceof ApiError ? e.message : "Unexpected error starting pipeline",
        }));
      }
    },
    [apply, closeStream, loadPending]
  );

  const approve = useCallback(async () => {
    const { pending, threadId } = state;
    if (!pending || !threadId) return;
    setState((s) => ({ ...s, phase: "executing", stages: { ...s.stages, hitl: "done", execution: "active" } }));
    try {
      const result = await api.approve(threadId, pending.approval_token, approverId);
      apply({ event: "completed", data: result as unknown as Record<string, any>, at: Date.now() });
      setState((s) => ({ ...s, result, pending: null }));
      return result;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Approval failed";
      setState((s) => ({
        ...s,
        phase: "failed",
        error: msg,
        stages: { ...s.stages, execution: "error" },
      }));
      throw e;
    }
  }, [apply, approverId, state]);

  const reject = useCallback(
    async (reason: string) => {
      const { threadId } = state;
      if (!threadId) return;
      await api.reject(threadId, reason, approverId);
      apply({ event: "rejected", data: { reason }, at: Date.now() });
      setState((s) => ({ ...s, pending: null }));
    },
    [apply, approverId, state]
  );

  const reset = useCallback(() => {
    closeStream();
    setState(initial);
  }, [closeStream]);

  return { state, start, approve, reject, reset };
}
