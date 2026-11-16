"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { CampusBuilding } from "@/lib/buildings";

export default function BuildingSelector({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true);
    api("/api/buildings").then(result => { if (active) { setBuildings(result.buildings.filter((b: CampusBuilding) => b.approved)); setError(""); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const visible = buildings.filter(b => b._id === value || `${b.displayName} ${b.code} ${b.category}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset disabled={disabled} className="space-y-2 border border-ink-line rounded-xl p-3">
    <legend className="text-sm px-1">Campus building / facility (optional)</legend>
    <input aria-label="Search approved buildings" className="cp-input" placeholder="Search approved name or code" value={search} onChange={e => setSearch(e.target.value)}/>
    <select aria-label="Grievance building" className="cp-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">No verified building selected</option>{visible.map(b => <option key={b._id} value={b._id}>{b.displayName}{b.code ? ` (${b.code})` : ""}</option>)}
      {value&&!buildings.some(b=>b._id===value)&&<option value={value} disabled>Existing selection unavailable; choose an approved building or clear</option>}
    </select>
    {loading && <p role="status" className="text-xs text-slate-soft">Loading approved buildings.</p>}
    {error && <p role="alert" className="text-xs text-critical">{error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Retry building list</button></p>}
    {!loading && !error && !buildings.length && <p className="text-xs text-slate-soft">Building names are awaiting Admin configuration. You can still submit and choose a map pin.</p>}
    <p className="text-xs text-slate-soft">Select only a building you can identify. Pins and building selection are independent; no association is inferred from coordinates.</p>
  </fieldset>;
}
