import { GrievancePriority, GrievanceStatus } from "@/types";

const PRIORITY_STYLES: Record<GrievancePriority, string> = {
  Low: "text-success bg-success/10 border-success/15",
  Medium: "text-amber bg-amber/10 border-amber/30",
  High: "text-accent bg-accent/10 border-accent/15",
  Critical: "text-critical bg-critical/10 border-critical/30",
};

export function PriorityBadge({ priority, score }: { priority: GrievancePriority; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1 ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
      {typeof score === "number" && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<GrievanceStatus, string> = {
  Pending: "text-amber bg-amber/10 border-amber/15",
  "In Progress": "text-progress bg-progress/10 border-progress/15",
  Resolved: "text-success bg-success/10 border-success/15",
};

const STATUS_DOT: Record<GrievanceStatus, string> = {
  Pending: "bg-amber",
  "In Progress": "bg-progress",
  Resolved: "bg-success",
};

export function StatusBadge({ status }: { status: GrievanceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1 transition-colors duration-300 ${STATUS_STYLES[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}
