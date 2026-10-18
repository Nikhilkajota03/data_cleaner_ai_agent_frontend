import { statusTone } from "@/lib/format";

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusTone(status)}`}>{status.replace(/_/g, " ")}</span>;
}
