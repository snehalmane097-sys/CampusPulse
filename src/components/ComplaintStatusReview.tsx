"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
export default function ComplaintStatusReview({ grievance: g, onSaved }: { grievance: any; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(g.status), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(()=>{setNote("");setError("");setNotice("");},[g._id]);
  useEffect(()=>{setStatus(g.status);},[g._id,g.status]);
  async function save() {
    setBusy(true);setError("");setNotice("");
    try {await api(`/api/grievances/${g._id}`,"PATCH",{status,note:note.trim(),expectedVersion:g.__v});setNote("");await onSaved();setNotice("Complaint update saved.");}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="space-y-3 border-t border-ink-line pt-5" aria-labelledby="complaint-status-heading">
    <h3 id="complaint-status-heading" className="font-display text-lg">Complaint status and review</h3>
    <p className="text-xs text-slate-soft">Current status: {g.status}. Investigation notes are visible only to administrators.</p>
    <label className="block text-sm">Update status<select aria-label="Complaint status" className="cp-input mt-1" value={status} disabled={busy||g.status==="Resolved"} onChange={e=>setStatus(e.target.value)}>{["Pending","In Progress","Resolved"].map(s=><option key={s}>{s}</option>)}</select></label>
    {g.status==="Resolved"&&<p className="text-xs text-slate-soft">Resolved complaints require an approved reopening request to change status. You can still add an investigation note.</p>}
    <label className="block text-sm">Investigation / update note<textarea aria-label="Investigation note" className="cp-input mt-1" maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="Record findings, progress or resolution details"/></label>
    <button type="button" className="cp-primary" disabled={busy||(status===g.status&&!note.trim())} onClick={save}>{busy?"Saving…":"Save complaint update"}</button>
    {error&&<p role="alert" className="text-critical text-sm">{error}</p>}{notice&&<p role="status" className="text-signal text-sm">{notice}</p>}
  </section>;
}
