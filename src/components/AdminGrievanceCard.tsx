import { GrievanceDTO } from "@/types";
import { StatusBadge } from "./Badges";
import { complaintTitle, originLabels } from "@/lib/complaintPresentation";
export default function AdminGrievanceCard({ grievance: g, onOpen }: { grievance: GrievanceDTO; onOpen: (id: string) => void }) {
  const origin = originLabels(g);
  const priorityColor = g.priorityLabel === "Critical" ? "text-critical" : ["High", "Medium"].includes(g.priorityLabel) ? "text-amber" : "text-signal";
  return <article className="glass-card p-5 space-y-4">
    <div className="flex items-start justify-between gap-4"><h3 className="font-display font-medium text-base leading-relaxed break-words min-w-0">{complaintTitle(g.rawText)}</h3><span className="shrink-0"><StatusBadge status={g.status}/></span></div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><span className={`inline-flex items-center gap-2 font-medium ${priorityColor}`}><span aria-hidden="true" className="w-2 h-2 rounded-full bg-current"/>{g.priorityLabel} priority</span><span className="text-slate-soft">{g.category}</span></div>
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm min-w-0"><div><dt className="text-xs text-slate-soft mb-1">Origin department</dt><dd className="break-words">{origin.department}</dd></div><div><dt className="text-xs text-slate-soft mb-1">Origin building / facility</dt><dd className="break-words">{origin.building}</dd></div></dl><button type="button" className="cp-primary shrink-0 w-full sm:w-auto" onClick={() => onOpen(g._id)}>View Complaint</button></div>
  </article>;
}
