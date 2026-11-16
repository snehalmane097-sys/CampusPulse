import { GrievanceDTO } from "@/types";
import { PriorityBadge, StatusBadge } from "./Badges";
import { formatDistanceToNow } from "date-fns";
import { complaintTitle, originLabels } from "@/lib/complaintPresentation";
export default function GrievanceCard({ grievance: g, onOpen }: { grievance: GrievanceDTO; index?: number; onOpen?: (id:string)=>void }) {
  const origin=originLabels(g);
  return <article className="glass-card p-5 space-y-4">
    <div className="flex items-start justify-between gap-3"><h3 className="font-display font-semibold text-sm leading-relaxed min-w-0 break-words">{complaintTitle(g.rawText)}</h3><span className="shrink-0"><StatusBadge status={g.status}/></span></div>
    <div className="flex flex-wrap gap-3 items-center text-xs text-slate-soft"><PriorityBadge priority={g.priorityLabel}/><span>{g.category}</span><time className="sm:ml-auto" dateTime={g.createdAt}>{formatDistanceToNow(new Date(g.createdAt),{addSuffix:true})}</time></div>
    <p className="text-xs leading-relaxed text-slate-soft break-words">Origin: {origin.department} · {origin.building}</p>
    {onOpen&&<button type="button" className="text-sm font-semibold text-signal hover:underline" onClick={()=>onOpen(g._id)}>View complaint <span aria-hidden="true">→</span></button>}
  </article>;
}
