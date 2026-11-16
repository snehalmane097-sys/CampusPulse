"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { divIcon, CircleMarker as LeafletCircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AnalyticsDTO } from "@/types";
import { CAMPUS_FEATURES, CATEGORY_COLORS, featurePoint, filterReports, clusterReports, inSelectionArea, MapLocation, MapReport, reportCoordinates } from "@/lib/campusMap";
import { buildingLabel, approvedCampusFeatures, CampusBuilding, BuildingSummary } from "@/lib/buildings";
import { THEME_COLORS as UI_COLORS } from "@/lib/designTokens";
import { OSM_ATTRIBUTION, satelliteTiles, STANDARD_TILES } from "@/lib/mapTiles";
import { api } from "@/lib/client";
import { getSocket } from "@/lib/socketClient";
import LeafletViewport from "./LeafletViewport";

const pinIcon=divIcon({className:"cp-map-pin",html:'<span aria-hidden="true">📍</span>',iconSize:[30,36],iconAnchor:[15,34]});
function MapEvents({onZoom,onPick,onView}:{onZoom:(z:number)=>void;onPick?:(p:MapLocation)=>void;onView:(p:[number,number])=>void}) {
  const map=useMapEvents({zoomend:()=>onZoom(map.getZoom()),moveend:()=>{const c=map.getCenter();onView([c.lat,c.lng]);},click:e=>onPick?.({lat:e.latlng.lat,lng:e.latlng.lng})});
  useEffect(()=>{const resize=new ResizeObserver(()=>map.invalidateSize({animate:false}));resize.observe(map.getContainer());return()=>resize.disconnect();},[map]);
  return null;
}
function FeatureFocus({id}:{id:string|null}) {
  const map=useMap();
  useEffect(()=>{const f=CAMPUS_FEATURES.find(f=>f.id===id);if(f)map.setView(featurePoint(f),Math.max(18,map.getZoom()));},[map,id]);
  return null;
}
function ReportPopup({g,onOpen,onSelect,onOpenIncident}:{g:MapReport;onOpen?:(id:string)=>void;onSelect:(id:string)=>void;onOpenIncident?:(id:string)=>void}) {
  return <article className="space-y-1"><p className="font-semibold">{g.category} · {g.priorityLabel}</p><p>{g.rawText}</p><p>{g.status} · {new Date(g.createdAt).toLocaleDateString()}</p><p>Origin department: {g.origin?.department||"Not verified"} · Building: {g.origin?.building?.displayName||"Not verified"}</p><p>{g.location}{g.isAnonymous?" · Anonymous report":""}</p>{g.incident&&<p>Linked campus incident {onOpenIncident&&<button type="button" className="underline" onClick={()=>onOpenIncident(g.incident!)}>View linked incident</button>}</p>}<button type="button" onClick={()=>{onSelect(g._id);onOpen?.(g._id);}} className="underline">View grievance</button></article>;
}
interface Props { data?:AnalyticsDTO|null; admin?:boolean; onOpenGrievance?:(id:string)=>void; onOpenIncident?:(id:string)=>void; selection?:MapLocation|null; onLocationConfirm?:(p:MapLocation|null)=>void; onSelectionPending?:()=>void; refreshKey?:number; }
export default function CampusMap({admin=false,onOpenGrievance,onOpenIncident,selection,onLocationConfirm,onSelectionPending,refreshKey=0}:Props) {
  const [reports,setReports]=useState<MapReport[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[tileError,setTileError]=useState(""),[style,setStyle]=useState<"standard"|"satellite">("standard"),[tileVersion,setTileVersion]=useState(0);
  const [search,setSearch]=useState(""),[featureId,setFeatureId]=useState<string|null>(null),[selectedReport,setSelectedReport]=useState<string|null>(null),[zoom,setZoom]=useState(17),[viewCenter,setViewCenter]=useState<[number,number]>([18.464,73.868]);
  const [draft,setDraft]=useState<MapLocation|null>(selection||null),[pickError,setPickError]=useState(""),[filters,setFilters]=useState({category:"",priority:"",status:""});
  const [department,setDepartment]=useState("");
  const [departments,setDepartments]=useState<{department:string;total:number;pending:number;inProgress:number;resolved:number;highPriority:number}[]>([]);
  const [buildings,setBuildings]=useState<CampusBuilding[]>([]),[summaries,setSummaries]=useState<BuildingSummary[]>([]),[from,setFrom]=useState(""),[to,setTo]=useState(""),[reload,setReload]=useState(0),[showBuildingReports,setShowBuildingReports]=useState(false);
  const filterQuery=useMemo(()=>new URLSearchParams({...filters,...(department?{originDepartment:department}:{}),...(from?{from}:{}),...(to?{to}:{})}).toString(),[filters,from,to,department]);
  const imagery=useMemo(satelliteTiles,[]);
  useEffect(()=>setDraft(selection||null),[selection]);
  useEffect(()=>{
    setLoading(true);setReports([]);setSummaries([]);setDepartments([]);
    let cancelled=false,revision=0;
    async function load() {
      const version=++revision;try {
        const [metadata,counts,origins]=await Promise.all([api("/api/buildings"),api("/api/buildings/analytics?"+filterQuery),api("/api/grievances/departments?"+filterQuery)]);
        let cursor:string|null=null;const rows:MapReport[]=[];const seen=new Set<string>();
        do {const result=await api("/api/grievances/map?limit=200&"+filterQuery+(cursor?"&cursor="+cursor:""));rows.push(...result.reports);cursor=result.nextCursor;if(cursor&&seen.has(cursor))throw new Error("Map pagination did not advance.");if(cursor)seen.add(cursor);}while(cursor&&!cancelled&&version===revision);
        if(!cancelled&&version===revision){setDepartments(origins.departments);setBuildings(metadata.buildings);setSummaries(counts.summaries);setReports(Array.from(new Map(rows.map(g=>[g._id,g])).values()));setError("");}
      }catch(e:any){if(!cancelled&&version===revision)setError(e.message);}finally{if(!cancelled&&version===revision)setLoading(false);}
    }
    const onFocus=()=>{ void load(); };window.addEventListener("focus",onFocus);
    load();const socket=getSocket();socket.on("grievance:new",load);socket.on("grievance:statusChanged",load);socket.on("grievance:buildingChanged",load);socket.on("connect",load);
    const timer=setInterval(load,30000);return()=>{window.removeEventListener("focus",onFocus);cancelled=true;revision++;clearInterval(timer);socket.off("grievance:new",load);socket.off("grievance:statusChanged",load);socket.off("grievance:buildingChanged",load);socket.off("connect",load);};
  },[refreshKey,filterQuery,reload]);
  const visible=useMemo(()=>filterReports(reports,filters),[reports,filters]);
  const groups=useMemo(()=>clusterReports(visible,zoom),[visible,zoom]);
  const labelFor=(f:(typeof CAMPUS_FEATURES)[number])=>buildingLabel(f,buildings);
  const features=approvedCampusFeatures(buildings,search);
  const selectedFeature=CAMPUS_FEATURES.find(f=>f.id===featureId);
  const selectedBuilding=buildings.find(b=>b.featureId===featureId);
  const selectedSummary=summaries.find(s=>s.buildingId===selectedBuilding?._id);
  const buildingReports=selectedBuilding?visible.filter(g=>g.building===selectedBuilding._id):[];
  const selected=reports.find(g=>g._id===selectedReport);
  const pick=useCallback((p:MapLocation)=>{if(!inSelectionArea(p.lat,p.lng)){setPickError("Choose a point near the campus. The selection window is not an official boundary.");return;}setPickError("");setDraft(p);onSelectionPending?.();},[onSelectionPending]);
  function chooseStyle(next:"standard"|"satellite") {
    if(next==="satellite"&&!imagery){setTileError("Satellite imagery is unavailable. Standard map remains available.");return;}
    setTileError("");setStyle(next);
  }
  const tileFailure=useCallback(()=>{if(style==="satellite"){setStyle("standard");setTileError("Satellite tiles are unavailable. Returned to Standard; your view and selections are preserved.");}else setTileError("Street tiles could not load. Try again when your connection is available.");},[style]);
  return <section className="cp-campus-map glass-card p-4 space-y-3" aria-label={admin?"Campus grievance radar":"VIT campus explorer"}>
    <div className="flex flex-wrap gap-3 justify-between items-start">
      <div><h2 className="font-display text-lg">VIT Bibwewadi campus</h2><p className="text-xs text-slate-soft">Campus locations and reported issues.</p></div>
      <div role="group" aria-label="Map style" className="flex gap-1 rounded-xl border border-ink-line p-1">{(["standard","satellite"] as const).map(s=><button key={s} type="button" aria-pressed={style===s} onClick={()=>chooseStyle(s)} className={style===s?"cp-primary":"cp-secondary"}>{s==="standard"?"Standard":"Satellite"}</button>)}</div>
    </div>
    <div className="flex items-center gap-2">
      <input aria-label="Search campus buildings and facilities" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mapped facilities" className="cp-input"/>
      <button type="button" className="cp-secondary" onClick={()=>setReload(n=>n+1)}>Refresh</button>
    </div>
    <details className="rounded-xl border border-ink-line px-3 py-2"><summary className="cursor-pointer text-sm font-medium">Filter reports{(filters.category||filters.priority||filters.status||from||to||department)&&<span className="ml-2 text-xs text-signal">Active</span>}</summary><div className="grid sm:grid-cols-3 gap-2 mt-3">
      <select aria-label="Map grievance category" className="cp-input" value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All categories</option>{Object.keys(CATEGORY_COLORS).map(c=><option key={c}>{c}</option>)}</select>
      <select aria-label="Map grievance priority" className="cp-input" value={filters.priority} onChange={e=>setFilters({...filters,priority:e.target.value})}><option value="">All priorities</option>{["Low","Medium","High","Critical"].map(c=><option key={c}>{c}</option>)}</select>
      <select aria-label="Map grievance status" className="cp-input" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option value="open">Open (not resolved)</option><option value="Pending">Pending</option><option value="In Progress">In progress</option><option value="Resolved">Resolved</option></select>
    </div><div className="flex flex-wrap gap-3 items-end mt-3">
      <label className="text-xs text-slate-soft">Reported from (UTC)<input type="date" aria-label="Map from date" className="cp-input mt-1" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="text-xs text-slate-soft">Through (UTC)<input type="date" aria-label="Map to date" className="cp-input mt-1" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button type="button" className="cp-secondary" onClick={()=>{setFilters({category:"",priority:"",status:""});setFrom("");setTo("");setDepartment("");}}>Clear filters</button>
    </div></details>
    <section className="space-y-2" aria-label="Origin department reports">
      <label className="text-sm">Origin department<select className="cp-input mt-1" value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All origin departments</option>{department&&!departments.some(d=>d.department===department)&&<option value={department}>{department} (0)</option>}{departments.filter(d=>d.department).map(d=><option key={d.department} value={d.department}>{d.department} ({d.total})</option>)}</select></label>
      <div className="flex gap-2 overflow-x-auto pb-1">{departments.filter(d=>!department||d.department===department).map(d=><div key={d.department} className="shrink-0 rounded-xl bg-ink-raised p-3 text-xs"><p className="font-semibold text-sm">{d.department||"Not verified"}: {d.total}</p><p>Pending {d.pending} / In progress {d.inProgress} / Resolved {d.resolved}</p><p>High / critical {d.highPriority}</p></div>)}</div>
    </section>
    <div className="max-h-24 sm:max-h-32 overflow-auto flex gap-2 flex-wrap" aria-label="Approved campus facilities">{features.map(f=><button key={f.id} type="button" className="cp-secondary text-xs" onClick={()=>setFeatureId(f.id)}>{labelFor(f)}</button>)}{!features.length&&!loading&&<p className="text-sm text-slate-soft">No approved campus location matches.</p>}</div>
    {loading&&<p role="status" className="text-sm text-slate-soft">Loading authorized grievance locations…</p>}
    {error&&<p role="alert" className="text-critical text-sm">{error} Map background remains available; grievance data may be unavailable or stale.</p>}
    {tileError&&<p role="status" className="text-amber text-sm">{tileError} <button type="button" className="underline" onClick={()=>{setTileError("");setTileVersion(v=>v+1);}}>Retry tiles</button></p>}
    <div className="h-[380px] sm:h-[460px] rounded-xl overflow-hidden border border-ink-line relative isolate">
      <LeafletViewport>
        <TileLayer key={style+tileVersion} url={style==="satellite"&&imagery?imagery.url:STANDARD_TILES} attribution={style==="satellite"&&imagery?OSM_ATTRIBUTION+" | "+imagery.attribution:OSM_ATTRIBUTION} maxZoom={20} maxNativeZoom={19} referrerPolicy="strict-origin-when-cross-origin" eventHandlers={{tileerror:tileFailure}}/>
        <MapEvents onZoom={setZoom} onView={setViewCenter} onPick={onLocationConfirm?pick:undefined}/>
        <FeatureFocus id={featureId}/>
        {CAMPUS_FEATURES.map(f=><GeoJSON key={f.id} data={f} style={{color:f.properties.category==="campus"?"#247b65":featureId===f.id?"#f2a93b":"#556d8a",weight:f.properties.category==="path"?2:1,fillOpacity:f.properties.category==="campus"?0.03:0.16,dashArray:f.properties.category==="campus"?"5 5":undefined}} pointToLayer={(_feature,latlng)=>new LeafletCircleMarker(latlng,{radius:5,color:"#247b65"})} eventHandlers={{click:()=>{if(labelFor(f))setFeatureId(f.id);}}}>{labelFor(f)?<Tooltip>{labelFor(f)}</Tooltip>:null}</GeoJSON>)}
        {buildings.filter(b=>b.approved).map(b=>{
          const f=CAMPUS_FEATURES.find(f=>f.id===b.featureId),summary=summaries.find(s=>s.buildingId===b._id);
          if(!f||!summary)return null;
          const color=summary.total>=10?UI_COLORS.danger:summary.total>=5?UI_COLORS.pending:UI_COLORS.success;
          return <CircleMarker key={"building-"+b._id} center={featurePoint(f)} radius={summary.total?Math.min(30,12+Math.log2(summary.total)*3):5} pathOptions={{color:featureId===b.featureId?"#fff":color,weight:2,fillColor:color,fillOpacity:summary.total?0.6:0.2}} eventHandlers={{click:()=>{setFeatureId(b.featureId);setShowBuildingReports(false);}}}>
            <Tooltip permanent direction="top">{zoom>=18?b.displayName+" · ":""}{summary.total} {summary.total===1?"report":"reports"}</Tooltip>
          </CircleMarker>;
        })}
        {groups.map(group=><CircleMarker key={group.id} center={[group.lat,group.lng]} radius={group.reports.length>1?Math.min(26,12+Math.log2(group.reports.length)*3):9} pathOptions={{color:group.reports.some(g=>g.priorityLabel==="Critical")?"#E5555C":group.reports.some(g=>g.priorityLabel==="High")?"#F2A93B":"#fff",weight:group.reports.some(g=>["High","Critical"].includes(g.priorityLabel))?3:1,fillColor:group.reports.length===1?CATEGORY_COLORS[group.reports[0].category]||"#a2adb9":"#705aaf",fillOpacity:0.85}} eventHandlers={{click:()=>setSelectedReport(group.reports[0]._id)}}>
          <Tooltip>{group.reports.length===1?group.reports[0].category:group.reports.length+" nearby grievances"}</Tooltip>
          <Popup><div className="max-h-64 overflow-auto space-y-3">{group.reports.map(g=><ReportPopup key={g._id} g={g} onOpen={onOpenGrievance} onSelect={setSelectedReport} onOpenIncident={admin?onOpenIncident:undefined}/>)}</div></Popup>
        </CircleMarker>)}
        {onLocationConfirm&&draft&&<Marker position={[draft.lat,draft.lng]} icon={pinIcon} draggable eventHandlers={{dragend:e=>{const p=e.target.getLatLng();pick({lat:p.lat,lng:p.lng});}}}/>}
      </LeafletViewport>
      {style==="satellite"&&imagery?.url.includes("api.maptiler.com/")&&<a href="https://www.maptiler.com/" target="_blank" rel="noreferrer" className="absolute bottom-2 left-2 z-[500] bg-white rounded px-1"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler logo" width="100" height="30"/></a>}
    </div>
    <p className="text-xs text-slate-soft">{admin?"Campus reports":"Your reports"} · {visible.filter(g=>reportCoordinates(g)).length} location pins · {visible.length} matching reports</p>
    <div className="flex flex-wrap gap-4 text-xs text-slate-soft" aria-label="Building report count legend"><span>Building reports</span><span className="text-success">● 0–4</span><span className="text-amber">● 5–9</span><span className="text-critical">● 10+</span></div>
    {selectedBuilding&&selectedSummary&&selectedBuilding.approved&&<aside className="rounded-xl border border-signal/30 p-4 space-y-3" aria-label="Building grievance summary">
      <h3 className="font-display text-lg">{selectedBuilding.displayName}{!selectedBuilding.approved&&<span className="text-xs text-amber ml-2">Not approved</span>}</h3>
      <p className="text-sm text-slate-soft">{selectedBuilding.category}{selectedBuilding.code?" · "+selectedBuilding.code:""}</p>{selectedBuilding.description&&<p className="text-sm whitespace-pre-wrap">{selectedBuilding.description}</p>}
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">{[["Total",selectedSummary.total],["Open",selectedSummary.open],["In progress",selectedSummary.inProgress],["Resolved",selectedSummary.resolved],["High / critical",selectedSummary.highPriority]].map(([name,value])=><div key={name}><dt className="text-xs text-slate-soft">{name}</dt><dd className="font-semibold text-lg">{value}</dd></div>)}</dl>
      <p className="text-xs text-slate-soft">{selectedSummary.categories.map(c=>`${c.category}: ${c.count}`).join(" · ")||"No associated reports match these filters."}</p>
      <button type="button" className="cp-secondary" onClick={()=>setShowBuildingReports(v=>!v)}>{showBuildingReports?"Hide":"View"} associated grievances</button>
      {showBuildingReports&&<div className="max-h-72 overflow-auto space-y-3">{buildingReports.map(g=><div key={g._id} className="border-t border-ink-line pt-2 text-sm"><ReportPopup g={g} onOpen={onOpenGrievance} onSelect={setSelectedReport} onOpenIncident={admin?onOpenIncident:undefined}/></div>)}{!buildingReports.length&&<p className="text-sm text-slate-soft">No authorized associated reports match.</p>}</div>}
    </aside>}
    {onLocationConfirm&&selectedFeature&&labelFor(selectedFeature)&&<div className="flex flex-wrap items-center gap-3 text-sm"><span>{labelFor(selectedFeature)}</span><button type="button" className="cp-secondary" onClick={()=>{const p=featurePoint(selectedFeature);pick({lat:p[0],lng:p[1],featureId:selectedFeature.id});}}>Place pin here</button><button type="button" className="text-slate-soft underline" onClick={()=>setFeatureId(null)}>Clear selection</button></div>}
    {selected&&<aside className="border border-ink-line rounded-xl p-3 text-sm"><ReportPopup g={selected} onOpen={onOpenGrievance} onSelect={setSelectedReport} onOpenIncident={admin?onOpenIncident:undefined}/><button type="button" className="underline mt-2" onClick={()=>setSelectedReport(null)}>Clear selected grievance</button></aside>}
    {onLocationConfirm&&<div className="space-y-2 border-t border-ink-line pt-3"><p className="text-sm">Click the map or drag the pin, then confirm. Keyboard users can pan/zoom with map controls and place the pin at the map center.</p><div className="flex flex-wrap gap-2"><button type="button" className="cp-secondary" onClick={()=>pick({lat:viewCenter[0],lng:viewCenter[1]})}>Move pin to map center</button><button type="button" disabled={!draft} className="cp-primary" onClick={()=>draft&&onLocationConfirm(draft)}>Confirm selected location</button><button type="button" className="cp-secondary" onClick={()=>{setDraft(null);onLocationConfirm(null);}}>Clear location</button></div>{draft&&<p className="text-xs">Selected pin: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)} {selection?.lat===draft.lat&&selection?.lng===draft.lng?"· Confirmed":"· Not yet confirmed"}</p>}{pickError&&<p role="alert" className="text-critical text-sm">{pickError}</p>}</div>}
  </section>;
}
