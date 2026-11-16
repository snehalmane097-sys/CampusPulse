import { GrievanceDTO } from "@/types";
import { PriorityBadge, StatusBadge } from "./Badges";
import { originLabels } from "@/lib/complaintPresentation";
export default function ComplaintDetails({ grievance: g }: { grievance: GrievanceDTO }) {
  const origin = originLabels(g);
  return <section aria-labelledby="complaint-details-heading" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="complaint-details-heading" className="font-display text-lg">Complaint details</h3><StatusBadge status={g.status}/></div>
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{g.rawText}</p>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
      <div><dt className="text-xs text-slate-soft mb-1">Submitted</dt><dd>{new Date(g.createdAt).toLocaleString()}</dd></div>
      <div><dt className="text-xs text-slate-soft mb-1">Priority / category</dt><dd className="flex flex-wrap gap-2 items-center"><PriorityBadge priority={g.priorityLabel}/><span>{g.category}</span></dd></div>
      <div className="min-w-0"><dt className="text-xs text-slate-soft mb-1">Origin department</dt><dd className="break-words">{origin.department}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-slate-soft mb-1">Origin building / facility</dt><dd className="break-words">{origin.building}</dd></div>
    </dl>
    {g.isAnonymous&&<p className="text-xs text-slate-soft">Anonymous complaint</p>}
  </section>;
}
