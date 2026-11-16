"use client";
import { useEffect, useState } from "react";
import BuildingSelector from "./BuildingSelector";
import { api } from "@/lib/client";

export default function BuildingAssociationPanel({ grievance, onSaved }: { grievance: { _id: string; building?: string; buildingRevision?: number; originDepartment?: string }; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(grievance.building || ""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [department, setDepartment] = useState(grievance.originDepartment || "");
  useEffect(() => { setSelected(grievance.building || ""); setDepartment(grievance.originDepartment || ""); setReason(""); setError(""); }, [grievance._id, grievance.building, grievance.buildingRevision, grievance.originDepartment]);
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/grievances/${grievance._id}/building`, "PATCH", { buildingId: selected || null, originDepartment: department.trim() || null, expectedRevision: grievance.buildingRevision || 0, reason });
      await onSaved(); setNotice("Verified origin saved. Routing, status and the original pin are unchanged.");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-ink-line pt-4">
    <h3 className="font-display text-lg">Verified building association (Admin)</h3>
    <p className="text-xs text-slate-soft">Review the report and verify its physical location before assigning it. An AIML department or laboratory mention alone does not identify a building. This changes only the building association, not routing, status, anonymity or the saved pin.</p>
    <BuildingSelector value={selected} onChange={setSelected} disabled={busy}/>
    <label className="block text-sm">Verified origin department (optional)<input aria-label="Verified origin department" className="cp-input mt-1" maxLength={120} disabled={busy} value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Leave blank if not verified"/></label>
    <p className="text-xs text-slate-soft">Enter only a verified complaint-origin department, not the service department responsible for resolution. Clearing this field removes its verification.</p>
    <label className="block text-sm">Verification / correction reason<textarea aria-label="Building association verification reason" className="cp-input mt-1" maxLength={1000} minLength={3} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="How did you verify this physical building? Explain corrections or removal."/></label>
    <button type="button" className="cp-primary" disabled={busy || reason.trim().length < 3 || (selected === (grievance.building || "") && department.trim() === (grievance.originDepartment || ""))} onClick={save}>{busy ? "Saving…" : "Save verified origin"}</button>
    {error && <p role="alert" className="text-critical text-sm">{error} Reload the grievance if another Admin changed it.</p>}{notice && <p role="status" className="text-signal text-sm">{notice}</p>}
  </section>;
}
