export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function shortId(id?: string | null) {
  return id ? id.slice(0, 8) : "—";
}

/** Same rule as the backend dirty-data check: E.164. */
export const isValidPhone = (p?: string | null) => !!p && /^\+[1-9]\d{6,14}$/.test(p);
export const isIsoCountry = (c?: string | null) => !!c && /^[A-Z]{2}$/.test(c);

export function statusTone(status: string): "green" | "red" | "amber" | "cyan" | "violet" | "gray" {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "HEALTHY":
    case "APPROVED":
    case "ACTIVE":
      return "green";
    case "FAILED":
    case "REJECTED":
    case "UNHEALTHY":
      return "red";
    case "PENDING_APPROVAL":
    case "DEGRADED":
      return "amber";
    case "ROLLED_BACK":
      return "violet";
    case "EXECUTING":
    case "PENDING_REASONING":
      return "cyan";
    default:
      return "gray";
  }
}

export function pretty(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
