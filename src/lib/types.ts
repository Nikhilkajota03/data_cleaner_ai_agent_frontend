/** Shared API contract types (mirrors backend/app/api/schemas.py and audit.py). */

export type HealthState = "HEALTHY" | "UNHEALTHY" | "DEGRADED" | string;

export interface Health {
  status: string;
  service: string;
  environment: string;
  postgres_governance_db: HealthState;
  postgres_staging_db: HealthState;
  redis: HealthState;
  fastmcp_sandbox: HealthState;
}

export interface UserOut {
  username: string;
  email: string;
  role: string;
  is_admin: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserOut;
}

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  gdpr_consent: boolean;
  consent_date: string | null;
  status: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  amount_raw: string | null;
  amount_standardized: string | number | null;
  currency: string | null;
  invoice_date: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface ClientDetail extends Client {
  invoices: Invoice[];
}

export interface PipelineRunResponse {
  thread_id: string;
  status: string;
  message: string;
  detected_pii_count: number;
}

export interface SqlQuery {
  target_table: string;
  operation: string;
  sql_statement: string;
  rationale: string;
  is_safe: boolean;
}

export interface PendingApproval {
  thread_id: string;
  plan_id: string;
  plan_hash: string;
  approval_token: string;
  status: string;
  proposed_plan: {
    plan_id: string;
    summary: string;
    targeted_tables: string[];
    queries: SqlQuery[];
    is_read_only: boolean;
    simulated_affected_rows: number | null;
    rationale: string;
  };
  judge_evaluation: {
    score: number;
    passed: boolean;
    verdict: string;
    feedback: string;
    detected_violations: string[];
    recommendations: string[];
  };
  detected_pii: unknown[];
}

export interface ApproveResponse {
  thread_id: string;
  execution_id: string;
  status: string;
  total_affected_rows: number;
  pre_images_captured: number;
  payload_s3_uri: string | null;
  message: string;
  query_results?: Array<Record<string, unknown>>;
}

export interface RollbackResponse {
  execution_id: string;
  status: string;
  restored_rows: number;
  target_tables: string[];
  message: string;
}

export interface PurgeResponse {
  status: string;
  retention_days: number;
  cutoff_timestamp: string;
  purged_clients: number;
  purged_invoices: number;
  total_purged_rows: number;
}

export interface SeedResponse {
  status: string;
  message: string;
  clients_seeded: number;
  invoices_seeded: number;
  sample_client_ids: string[];
}

export interface ExecutionSummary {
  execution_id: string;
  plan_id: string;
  thread_id: string;
  master_goal: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  judge_score: number | null;
  plan_summary: string | null;
  affected_rows: number | null;
  pre_images_captured: number;
  started_at: string;
  completed_at: string | null;
  can_rollback: boolean;
}

export interface RowDiff {
  pre_image_id: string;
  target_table: string;
  primary_key_value: string;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  changed_fields: string[];
}

export interface ExecutionDetail extends ExecutionSummary {
  queries: SqlQuery[];
  judge_feedback: string | null;
  diffs: RowDiff[];
  query_results?: Array<Record<string, unknown>>;
  is_read_only?: boolean;
}

export interface CrmStats {
  total_clients: number;
  soft_deleted_clients: number;
  missing_gdpr_consent: number;
  malformed_phones: number;
  total_invoices: number;
  unstandardized_invoices: number;
}

export interface RetentionStats {
  retention_days: number;
  cutoff_timestamp: string;
  soft_deleted_clients: number;
  soft_deleted_invoices: number;
  purge_eligible_clients: number;
  purge_eligible_invoices: number;
}

/** Pipeline SSE event names emitted by the backend. */
export type PipelineEventName =
  | "pipeline_started"
  | "node_guardrail_completed"
  | "node_planner_completed"
  | "node_judge_completed"
  | "hitl_paused"
  | "completed"
  | "failed"
  | "rejected"
  | "rolled_back";

export interface PipelineEvent {
  event: PipelineEventName;
  data: Record<string, any>;
  at: number;
}
