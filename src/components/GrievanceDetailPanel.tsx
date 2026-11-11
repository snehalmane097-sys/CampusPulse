"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/client";
import Dialog from "./Dialog";
import EvidencePanel from "./EvidencePanel";
import { StatusBadge } from "./Badges";
import { getSocket } from "@/lib/socketClient";
export default function GrievanceDetailPanel({ id, admin, onClose, onChanged }: { id: string; admin: boolean; onClose: () => void; onChanged?: () => void }) {
  const [g, setG] = useState<any>(null), [feedback, setFeedback] = useState<any[]>([]), [requests, setRequests] = useState<any[]>([]), [rating, setRating] = useState(0), [comment, setComment] = useState(""), [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const version = useRef(0);
  const invalidate = useCallback(() => { ++version.current; }, []);
  const load = useCallback(async () => { const current = ++version.current; try { const [report, f, r] = await Promise.all([api(`/api/grievances/${id}`), api(`/api/grievances/${id}/feedback`), api(`/api/grievances/${id}/reopen-requests`)]); if (current !== version.current) return; setG(report.grievance); setFeedback(f.records); setRequests(r.records); setError(""); } catch(e: any) { if (current === version.current) setError(e.message); } }, [id]);
  useEffect(() => { setG(null); load(); const socket = getSocket(); const changed = (event: any) => { if (event.grievanceId === id) load(); }; socket.on("grievance:statusChanged", changed); socket.on("connect", load); return () => { invalidate(); socket.off("grievance:statusChanged", changed); socket.off("connect", load); }; }, [id, load, invalidate]);
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); await load(); onChanged?.(); } catch(e: any) { setError(e.message); } finally { setBusy(false); } }
  const currentFeedback = feedback.find(f => f.cycle === (g?.resolutionCycle || 0)), pending = requests.some(r => r.state === "pending");
  return <Dialog title="Grievance workspace" onClose={onClose}>
    {error && <p role="alert" className="text-critical">{error}</p>}{notice && <p role="status" className="text-signal">{notice}</p>}
    {!g ? <p className="text-slate-soft">Loading grievance…</p> : <>
      <div className="flex justify-between gap-3"><p className="text-sm whitespace-pre-wrap break-words">{g.rawText}</p><StatusBadge status={g.status}/></div><p className="text-xs text-slate-soft">{g.department} · {g.location}{g.isAnonymous ? " · Anonymous report" : ""}</p>
      <EvidencePanel grievanceId={id} admin={admin}/>
      <section className="space-y-3 border-t border-white/10 pt-4"><h3 className="font-display text-lg">Resolution feedback</h3>
        {!admin && g.status === "Resolved" && !currentFeedback && <div className="space-y-3"><div role="group" aria-label="Resolution rating" className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} type="button" aria-label={`${n} star${n===1?"":"s"}`} aria-pressed={rating === n} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "text-amber" : "text-slate-soft"}`}>★</button>)}</div><textarea aria-label="Written feedback" className="cp-input" maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} placeholder="How was the resolution? (optional)"/><button disabled={busy || !rating} className="cp-primary" onClick={() => act(async () => { await api(`/api/grievances/${id}/feedback`, "POST", { rating, comment }); setNotice("Thank you. Your feedback has been recorded."); })}>Submit feedback</button></div>}
        {!feedback.length && (admin || g.status !== "Resolved") && <p className="text-sm text-slate-soft">Feedback becomes available after resolution.</p>}
        {feedback.map(f => <div key={f._id} className="border border-white/10 rounded-lg p-3"><p className="text-amber">{"★".repeat(f.rating)}<span className="text-slate-soft">{"☆".repeat(5-f.rating)}</span><span className="text-xs text-slate-soft ml-2">Resolution {f.cycle || "legacy"}</span></p><p className="text-sm whitespace-pre-wrap break-words">{f.comment || "No written feedback"}</p></div>)}
      </section>
      <section className="space-y-3 border-t border-white/10 pt-4"><h3 className="font-display text-lg">Reopening requests</h3>
        {!admin && g.status === "Resolved" && !pending && <div className="space-y-3"><p className="text-xs text-slate-soft">If the issue persists, explain why it should be reopened. An administrator will review your request.</p><textarea aria-label="Reopening reason" className="cp-input" minLength={10} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe what remains unresolved"/><button disabled={busy || reason.trim().length < 10} className="cp-secondary" onClick={() => act(async () => { await api(`/api/grievances/${id}/reopen-requests`, "POST", { reason }); setReason(""); setNotice("Reopening request submitted for review."); })}>Request reopening</button></div>}
        {requests.map(r => <div key={r._id} className="border border-white/10 rounded-lg p-3 space-y-2"><p className="text-sm whitespace-pre-wrap break-words">{r.reason}</p><p className="text-xs text-amber">{r.state}</p>{r.decisionReason && <p className="text-sm">Decision: {r.decisionReason}</p>}{admin && r.state === "pending" && <Decision requestId={r._id} busy={busy} decide={(state, decisionReason) => act(async () => { await api(`/api/reopen-requests/${r._id}/decision`, "POST", { state, decisionReason }); })}/>}</div>)}
      </section>
      {g.history?.length > 0 && <section className="border-t border-white/10 pt-4"><h3 className="font-display mb-2">Status history</h3><ol className="space-y-2 text-xs text-slate-soft">{g.history.map((h: any,i: number) => <li key={i}>{h.status} · {new Date(h.at).toLocaleString()}</li>)}</ol></section>}
    </>}
  </Dialog>;
}
function Decision({ requestId, decide, busy }: { requestId: string; decide: (state: string, reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState("");
  return <div className="space-y-2"><textarea aria-label="Reopening decision reason" className="cp-input" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain your decision"/><div className="flex gap-2"><button disabled={busy || reason.trim().length < 3} className="cp-primary" onClick={() => decide("approved", reason)}>Approve reopening</button><button disabled={busy || reason.trim().length < 3} className="cp-secondary" onClick={() => decide("rejected", reason)}>Reject request</button></div></div>;
}
