import { GrievanceDTO } from "@/types";
import { PriorityBadge, StatusBadge } from "./Badges";
import { formatDistanceToNow } from "date-fns";

export default function GrievanceCard({ grievance, index = 0 }: { grievance: GrievanceDTO; index?: number }) {
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="glass-card glass-card-hover p-4 animate-rise"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed flex-1 min-w-0 break-words">{grievance.rawText}</p>
        <StatusBadge status={grievance.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <PriorityBadge priority={grievance.priorityLabel} score={grievance.priorityScore} />
        <span className="text-xs font-mono text-slate-soft border border-white/10 rounded-full px-2.5 py-1">
          {grievance.category}
        </span>
        <span className="text-xs font-mono text-slate-soft border border-white/10 rounded-full px-2.5 py-1">
          {grievance.location}
        </span>
        {grievance.affectedCount > 1 && (
          <span className="text-xs font-mono text-amber border border-amber/30 bg-amber/10 rounded-full px-2.5 py-1">
            +{grievance.affectedCount - 1} similar reports
          </span>
        )}
        <span className="text-xs text-slate-soft ml-auto">
          {formatDistanceToNow(new Date(grievance.createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
