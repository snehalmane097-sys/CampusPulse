"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { divIcon, CircleMarker as LeafletCircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AnalyticsDTO } from "@/types";
import { CAMPUS_FEATURES, CATEGORY_COLORS, featureLabel, featurePoint, filterReports, clusterReports, inSelectionArea, MapLocation, MapReport, reportCoordinates } from "@/lib/campusMap";
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
  return <article className="space-y-1"><p className="font-semibold">{g.category} · {g.priorityLabel}</p><p>{g.rawText}</p><p>{g.status} · {new Date(g.createdAt).toLocaleDateString()}</p><p>{g.location}{g.isAnonymous?" · Anonymous report":""}</p>{g.incident&&<p>Linked campus incident {onOpenIncident&&<button type="button" className="underline" onClick={()=>onOpenIncident(g.incident!)}>View linked incident</button>}</p>}<button type="button" onClick={()=>{onSelect(g._id);onOpen?.(g._id);}} className="underline">View grievance</button></article>;
}
interface Props { data?:AnalyticsDTO|null; admin?:boolean; onOpenGrievance?:(id:string)=>void; onOpenIncident?:(id:string)=>void; selection?:MapLocation|null; onLocationConfirm?:(p:MapLocation|null)=>void; onSelectionPending?:()=>void; refreshKey?:number; }
export default function CampusMap({data,admin=false,onOpenGrievance,onOpenIncident,selection,onLocationConfirm,onSelectionPending,refreshKey=0}:Props) {
  const [reports,setReports]=useState<MapReport[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[tileError,setTileError]=useState(""),[style,setStyle]=useState<"standard"|"satellite">("standard"),[tileVersion,setTileVersion]=useState(0);
  const [search,setSearch]=useState(""),[featureId,setFeatureId]=useState<string|null>(null),[selectedReport,setSelectedReport]=useState<string|null>(null),[zoom,setZoom]=useState(17),[viewCenter,setViewCenter]=useState<[number,number]>([18.464,73.868]);
  const [draft,setDraft]=useState<MapLocation|null>(selection||null),[pickError,setPickError]=useState(""),[filters,setFilters]=useState({category:"",priority:"",status:""});
  const imagery=useMemo(satelliteTiles,[]);
  useEffect(()=>setDraft(selection||null),[selection]);
  useEffect(()=>{
    let cancelled=false,revision=0;
    async function load() {
      const version=++revision;try {
        let cursor:string|null=null;const rows:MapReport[]=[];const seen=new Set<string>();
        do {const result=await api("/api/grievances/map?limit=200"+(cursor?"&cursor="+cursor:""));rows.push(...result.reports);cursor=result.nextCursor;if(cursor&&seen.has(cursor))throw new Error("Map pagination did not advance.");if(cursor)seen.add(cursor);}while(cursor&&!cancelled&&version===revision);
        if(!cancelled&&version===revision){setReports(Array.from(new Map(rows.map(g=>[g._id,g])).values()));setError("");}
      }catch(e:any){if(!cancelled&&version===revision)setError(e.message);}finally{if(!cancelled&&version===revision)setLoading(false);}
    }
    load();const socket=getSocket();socket.on("grievance:new",load);socket.on("grievance:statusChanged",load);socket.on("connect",load);
    const timer=setInterval(load,30000);return()=>{cancelled=true;revision++;clearInterval(timer);socket.off("grievance:new",load);socket.off("grievance:statusChanged",load);socket.off("connect",load);};
  },[refreshKey]);
  const visible=useMemo(()=>filterReports(reports,filters),[reports,filters]);
  const groups=useMemo(()=>clusterReports(visible,zoom),[visible,zoom]);
  const features=useMemo(()=>CAMPUS_FEATURES.filter(f=>(featureLabel(f)+" "+f.properties.category).toLowerCase().includes(search.toLowerCase())).slice(0,30),[search]);
  const selectedFeature=CAMPUS_FEATURES.find(f=>f.id===featureId);
  const selected=reports.find(g=>g._id===selectedReport);
  const pick=useCallback((p:MapLocation)=>{if(!inSelectionArea(p.lat,p.lng)){setPickError("Choose a point near the campus. The selection window is not an official boundary.");return;}setPickError("");setDraft(p);onSelectionPending?.();},[onSelectionPending]);
  function chooseStyle(next:"standard"|"satellite") {
    if(next==="satellite"&&!imagery){setTileError("Satellite imagery is not configured. Standard map remains available. " + (admin ? "Set NEXT_PUBLIC_MAPTILER_KEY in the local environment, then restart development or rebuild production." : "Contact your campus administrator."));return;}
    setTileError("");setStyle(next);
  }
  const tileFailure=useCallback(()=>{if(style==="satellite"){setStyle("standard");setTileError("Satellite tiles are unavailable. Returned to Standard; your view and selections are preserved.");}else setTileError("Street tiles could not load. Campus geometry and controls remain available. Check your connection or retry tiles.");},[style]);
  return <section className="cp-campus-map glass-card p-4 space-y-3" aria-label={admin?"Campus grievance radar":"VIT campus explorer"}>
    <div className="flex flex-wrap gap-3 justify-between items-start">
      <div><h2 className="font-display text-lg">VIT Bibwewadi campus</h2><p className="text-xs text-slate-soft">666, Upper Indira Nagar, Pune 411037 · OSM outline, not an official surveyed boundary.</p></div>
      <div role="group" aria-label="Map style" className="flex gap-1 rounded-xl border border-white/15 p-1">{(["standard","satellite"] as const).map(s=><button key={s} type="button" aria-pressed={style===s} onClick={()=>chooseStyle(s)} className={style===s?"cp-primary":"cp-secondary"}>{s==="standard"?"Standard":"Satellite"}</button>)}</div>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <input aria-label="Search campus buildings and facilities" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mapped facilities" className="cp-input"/>
      <select aria-label="Map grievance category" className="cp-input" value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All categories</option>{Object.keys(CATEGORY_COLORS).map(c=><option key={c}>{c}</option>)}</select>
      <select aria-label="Map grievance priority" className="cp-input" value={filters.priority} onChange={e=>setFilters({...filters,priority:e.target.value})}><option value="">All priorities</option>{["Low","Medium","High","Critical"].map(c=><option key={c}>{c}</option>)}</select>
      <select aria-label="Map grievance status" className="cp-input" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option value="open">Open (not resolved)</option><option value="Pending">Pending</option><option value="In Progress">In progress</option><option value="Resolved">Resolved</option></select>
    </div>
    {(search||selectedFeature)&&<div className="max-h-40 overflow-auto flex gap-2 flex-wrap">{features.map(f=><button key={f.id} type="button" className="cp-secondary text-xs" onClick={()=>setFeatureId(f.id)}>{featureLabel(f)}</button>)}{!features.length&&<p className="text-sm text-slate-soft">No mapped feature matches. Missing facilities have not been invented.</p>}</div>}
    {loading&&<p role="status" className="text-sm text-slate-soft">Loading authorized grievance locations…</p>}
    {error&&<p role="alert" className="text-critical text-sm">{error} Map background remains available; grievance data may be unavailable or stale.</p>}
    {tileError&&<p role="status" className="text-amber text-sm">{tileError} <button type="button" className="underline" onClick={()=>{setTileError("");setTileVersion(v=>v+1);}}>Retry tiles</button></p>}
    <div className="h-[380px] sm:h-[460px] rounded-xl overflow-hidden border border-white/10 relative isolate">
      <LeafletViewport>
        <TileLayer key={style+tileVersion} url={style==="satellite"&&imagery?imagery.url:STANDARD_TILES} attribution={style==="satellite"&&imagery?OSM_ATTRIBUTION+" | "+imagery.attribution:OSM_ATTRIBUTION} maxZoom={20} maxNativeZoom={19} referrerPolicy="strict-origin-when-cross-origin" eventHandlers={{tileerror:tileFailure}}/>
        <MapEvents onZoom={setZoom} onView={setViewCenter} onPick={onLocationConfirm?pick:undefined}/>
        <FeatureFocus id={featureId}/>
        {CAMPUS_FEATURES.map(f=><GeoJSON key={f.id} data={f} style={{color:f.properties.category==="campus"?"#247b65":featureId===f.id?"#f2a93b":"#556d8a",weight:f.properties.category==="path"?2:1,fillOpacity:f.properties.category==="campus"?0.03:0.16,dashArray:f.properties.category==="campus"?"5 5":undefined}} pointToLayer={(_feature,latlng)=>new LeafletCircleMarker(latlng,{radius:5,color:"#247b65"})} eventHandlers={{click:()=>setFeatureId(f.id)}}><Tooltip>{featureLabel(f)}</Tooltip></GeoJSON>)}
        {groups.map(group=><CircleMarker key={group.id} center={[group.lat,group.lng]} radius={group.reports.length>1?Math.min(26,12+Math.log2(group.reports.length)*3):9} pathOptions={{color:group.reports.some(g=>g.priorityLabel==="Critical")?"#E5555C":group.reports.some(g=>g.priorityLabel==="High")?"#F2A93B":"#fff",weight:group.reports.some(g=>["High","Critical"].includes(g.priorityLabel))?3:1,fillColor:group.reports.length===1?CATEGORY_COLORS[group.reports[0].category]||"#a2adb9":"#705aaf",fillOpacity:0.85}} eventHandlers={{click:()=>setSelectedReport(group.reports[0]._id)}}>
          <Tooltip>{group.reports.length===1?group.reports[0].category:group.reports.length+" nearby grievances"}</Tooltip>
          <Popup><div className="max-h-64 overflow-auto space-y-3">{group.reports.map(g=><ReportPopup key={g._id} g={g} onOpen={onOpenGrievance} onSelect={setSelectedReport} onOpenIncident={admin?onOpenIncident:undefined}/>)}</div></Popup>
        </CircleMarker>)}
        {onLocationConfirm&&draft&&<Marker position={[draft.lat,draft.lng]} icon={pinIcon} draggable eventHandlers={{dragend:e=>{const p=e.target.getLatLng();pick({lat:p.lat,lng:p.lng});}}}/>}
      </LeafletViewport>
      {style==="satellite"&&imagery?.url.includes("api.maptiler.com/")&&<a href="https://www.maptiler.com/" target="_blank" rel="noreferrer" className="absolute bottom-2 left-2 z-[500] bg-white rounded px-1"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler logo" width="100" height="30"/></a>}
    </div>
    <p className="text-xs text-slate-soft">{visible.filter(g=>reportCoordinates(g)).length} mapped / {visible.length} authorized matching grievances. {visible.filter(g=>!reportCoordinates(g)).length} lack verified coordinates and are not placed at a fabricated center. Overlapping markers group by zoom; outlines indicate priority.</p>
    <div className="flex flex-wrap gap-3 text-xs">{Object.entries(CATEGORY_COLORS).map(([c,color])=><span key={c}><span style={{backgroundColor:color}} className="inline-block w-2 h-2 rounded-full mr-1"/>{c}</span>)}</div>
    {data&&<p className="text-xs text-slate-soft">Existing location analytics: {data.hotspots.length} text-location groups. Unverified legacy block/lab positions are intentionally not plotted.</p>}
    {selectedFeature&&<aside className="rounded-xl border border-white/15 p-3 space-y-2"><h3 className="font-medium">{featureLabel(selectedFeature)}</h3><p className="text-sm">{selectedFeature.properties.category}{selectedFeature.properties.access?" · Access: "+selectedFeature.properties.access:""}</p>{selectedFeature.properties.description&&<p className="text-sm text-amber">{selectedFeature.properties.description}</p>}{selectedFeature.properties.openingHours&&<p>{selectedFeature.properties.openingHours}</p>}<a className="text-xs underline" target="_blank" rel="noreferrer" href={selectedFeature.properties.sourceUrl}>OSM source (community mapped)</a>{onLocationConfirm&&selectedFeature.properties.category!=="campus"&&<button type="button" className="cp-secondary ml-3" onClick={()=>{const p=featurePoint(selectedFeature);pick({lat:p[0],lng:p[1],featureId:selectedFeature.id});}}>Place pin at this feature</button>}<button type="button" className="cp-secondary ml-3" onClick={()=>setFeatureId(null)}>Close feature</button></aside>}
    {selected&&<aside className="border border-white/15 rounded-xl p-3 text-sm"><ReportPopup g={selected} onOpen={onOpenGrievance} onSelect={setSelectedReport} onOpenIncident={admin?onOpenIncident:undefined}/><button type="button" className="underline mt-2" onClick={()=>setSelectedReport(null)}>Clear selected grievance</button></aside>}
    {onLocationConfirm&&<div className="space-y-2 border-t border-white/10 pt-3"><p className="text-sm">Click the map or drag the pin, then confirm. Keyboard users can pan/zoom with map controls and place the pin at the map center.</p><div className="flex flex-wrap gap-2"><button type="button" className="cp-secondary" onClick={()=>pick({lat:viewCenter[0],lng:viewCenter[1]})}>Move pin to map center</button><button type="button" disabled={!draft} className="cp-primary" onClick={()=>draft&&onLocationConfirm(draft)}>Confirm selected location</button><button type="button" className="cp-secondary" onClick={()=>{setDraft(null);onLocationConfirm(null);}}>Clear location</button></div>{draft&&<p className="text-xs">Selected pin: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)} {selection?.lat===draft.lat&&selection?.lng===draft.lng?"· Confirmed":"· Not yet confirmed"}</p>}{pickError&&<p role="alert" className="text-critical text-sm">{pickError}</p>}</div>}
    <p className="text-xs text-slate-soft">OSM coverage is incomplete. Unnamed outlines are not assigned academic building names. <a className="underline" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </section>;
}
