import { GrievancePriority, GrievanceStatus } from "@/types";

const PRIORITY_STYLES: Record<GrievancePriority, string> = {
  Low: "text-signal bg-signal/10 border-signal/30",
  Medium: "text-amber bg-amber/10 border-amber/30",
  High: "text-amber bg-amber/10 border-amber/30",
  Critical: "text-critical bg-critical/10 border-critical/30",
};

export function PriorityBadge({ priority, score }: { priority: GrievancePriority; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono border rounded-full px-2.5 py-1 ${PRIORITY_STYLES[priority]} ${
        priority === "Critical" ? "animate-glowPulse" : ""
      }`}
    >
      {priority}
      {typeof score === "number" && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<GrievanceStatus, string> = {
  Pending: "text-slate-soft bg-white/5 border-ink-line",
  "In Progress": "text-amber bg-amber/10 border-amber/30",
  Resolved: "text-signal bg-signal/10 border-signal/30",
};

const STATUS_DOT: Record<GrievanceStatus, string> = {
  Pending: "bg-slate-soft",
  "In Progress": "bg-amber animate-pulse",
  Resolved: "bg-signal",
};

export function StatusBadge({ status }: { status: GrievanceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 transition-colors duration-300 ${STATUS_STYLES[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}
