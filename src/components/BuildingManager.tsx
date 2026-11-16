"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { CAMPUS_FEATURES } from "@/lib/campusMap";
import { BUILDING_CATEGORIES, CampusBuilding } from "@/lib/buildings";

const empty = { displayName: "", code: "", description: "", category: "Other", approved: false };
export default function BuildingManager({ buildings, selectedFeature, onSelect, onSaved, onIdentificationChange }: { buildings: CampusBuilding[]; selectedFeature: string | null; onSelect: (id: string) => void; onSaved: () => void; onIdentificationChange?: (open: boolean) => void }) {
  const [featureId, setFeatureId] = useState(""), [form, setForm] = useState(empty), [revision, setRevision] = useState(0), [recordId, setRecordId] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const loaded = useRef("");
  useEffect(() => { if (selectedFeature && CAMPUS_FEATURES.some(f => f.id === selectedFeature && f.properties.category !== "campus")) setFeatureId(selectedFeature); }, [selectedFeature]);
  useEffect(() => {
    const record = buildings.find(b => b.featureId === featureId);
    const identity = `${featureId}:${record?._id || ""}:${record?.revision || 0}`;
    if (loaded.current === identity) return;
    loaded.current = identity;
    setForm(record ? { displayName: record.displayName, code: record.code, description: record.description, category: record.category, approved: record.approved } : empty);
    setRevision(record?.revision || 0); setRecordId(record?._id || ""); setError("");
  }, [featureId, buildings]);
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(recordId ? `/api/buildings/${recordId}` : "/api/buildings", recordId ? "PATCH" : "POST", { ...form, ...(recordId ? { revision } : { featureId }) });
      setNotice("Saved. Approved names are available to students on refresh."); onSaved();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <details className="border border-ink-line rounded-xl p-3 space-y-3" onToggle={e => onIdentificationChange?.(e.currentTarget.open)}>
    <summary className="cursor-pointer font-medium">Manage campus buildings & facilities (Admin)</summary>
    <p className="text-xs text-slate-soft">Identify the footprint on the map before naming it. Source IDs are shown here for identification only. Geometry cannot be edited.</p>
    <select aria-label="Building footprint to manage" className="cp-input" value={featureId} disabled={busy} onChange={e => { setFeatureId(e.target.value); if (e.target.value) onSelect(e.target.value); }}>
      <option value="">Choose a mapped feature</option>{CAMPUS_FEATURES.filter(f => f.properties.category !== "campus").map(f => {
        const record = buildings.find(b => b.featureId === f.id);
        return <option key={f.id} value={f.id}>{record?.displayName || f.properties.name || "Awaiting identification"} — {f.id} ({f.properties.category})</option>;
      })}
    </select>
    {featureId && <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">Display name<input aria-label="Building display name" className="cp-input mt-1" maxLength={120} value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}/></label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Code (optional)<input className="cp-input mt-1" maxLength={30} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}/></label>
        <label className="text-sm">Category<select className="cp-input mt-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{BUILDING_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
      <label className="block text-sm">Description (optional)<textarea className="cp-input mt-1" maxLength={1200} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.approved} onChange={e => setForm({ ...form, approved: e.target.checked })}/>Approve for student selection and custom map labels</label>
      <p className="text-xs text-slate-soft">Unapprove to withdraw a name from selection. Existing grievance associations are retained. Names are unique, ignoring case.</p>
      <button type="button" className="cp-primary" disabled={!form.displayName.trim()} onClick={save}>{busy ? "Saving…" : recordId ? "Save building changes" : "Add building name"}</button>
    </fieldset>}
    {error && <p role="alert" className="text-critical text-sm">{error} Refresh the map data to reload a concurrent edit.</p>}{notice && <p role="status" className="text-signal text-sm">{notice}</p>}
  </details>;
}
