import { IncidentDTO } from "@/types";
import { StatusBadge } from "./Badges";
import { IconUsers } from "./Icons";

// Short, stable, human-readable incident code from the Mongo ObjectId's
// last 6 hex chars — purely cosmetic, doesn't touch the underlying id.
function incidentCode(id: string) {
  return `INC-${id.slice(-6).toUpperCase()}`;
}

export default function IncidentCard({
  incident,
  onClick,
  index = 0,
}: {
  incident: IncidentDTO;
  onClick?: () => void;
  index?: number;
}) {
  const severityColor =
    incident.severityScore >= 70 ? "bg-critical" : incident.severityScore >= 40 ? "bg-amber" : "bg-signal";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="glass-card glass-card-hover text-left w-full p-4 animate-rise"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-slate-soft">{incidentCode(incident._id)}</p>
          <h3 className="font-display font-semibold mt-0.5">{incident.title}</h3>
          <p className="text-xs text-slate-soft mt-0.5 flex items-center gap-1">
            <IconUsers className="w-3 h-3" /> {incident.department} · {incident.grievanceCount} linked report
            {incident.grievanceCount === 1 ? "" : "s"}
          </p>
        </div>
        <StatusBadge status={incident.status} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-soft mb-1">
          <span>Severity</span>
          <span>{incident.severityScore}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${severityColor} transition-all duration-500`}
            style={{ width: `${incident.severityScore}%` }}
          />
        </div>
      </div>
    </button>
  );
}
