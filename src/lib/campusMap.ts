import collection from "@/data/vit-bibwewadi.geojson.json";
import type { Feature, Geometry } from "geojson";

export const CAMPUS_CENTER: [number, number] = [18.464, 73.868];
// A navigation/selection window only, NOT a surveyed campus boundary.
export const MAP_VIEW_BOUNDS: [[number, number], [number, number]] = [[18.458, 73.862], [18.470, 73.875]];
export interface CampusProperties { name: string | null; category: string; sourceUrl: string; description?: string; openingHours?: string; access?: string; tags: Record<string,string>; }
export type CampusFeature = Feature<Geometry, CampusProperties> & { id: string };
export const CAMPUS_FEATURES = collection.features as unknown as CampusFeature[];
export interface MapLocation { lat: number; lng: number; featureId?: string; source?: "user-selected" | "osm-feature"; }
export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180;
}
export function inSelectionArea(lat: number, lng: number) {
  return validCoordinates(lat,lng) && lat >= MAP_VIEW_BOUNDS[0][0] && lat <= MAP_VIEW_BOUNDS[1][0] && lng >= MAP_VIEW_BOUNDS[0][1] && lng <= MAP_VIEW_BOUNDS[1][1];
}
export function featurePoint(f: CampusFeature): [number,number] {
  const g = f.geometry;
  if (g.type === "Point") return [g.coordinates[1],g.coordinates[0]];
  const points = (g.type === "Polygon" ? g.coordinates[0] : g.type === "LineString" ? g.coordinates : []) as number[][];
  return [(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2,(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2];
}
export function featureLabel(f: CampusFeature) { return f.properties.name || `Unnamed OSM ${f.properties.category} (${f.id})`; }
export function coordsFor(location: string): [number,number] | null {
  const f = CAMPUS_FEATURES.find(f=>f.properties.category !== "campus" && f.properties.name?.toLowerCase() === location?.trim().toLowerCase());
  return f ? featurePoint(f) : null;
}
export function validateMapLocation(value: unknown): MapLocation | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Select a valid map location.");
  const v = value as MapLocation;
  if (!inSelectionArea(v.lat,v.lng)) throw new Error("Select coordinates within the campus map selection area (not an official boundary).");
  if (v.featureId !== undefined && (typeof v.featureId !== "string" || !CAMPUS_FEATURES.some(f=>f.id===v.featureId))) throw new Error("Unknown campus feature.");
  if (v.featureId) {
    const point = featurePoint(CAMPUS_FEATURES.find(f=>f.id===v.featureId)!);
    if (Math.abs(v.lat-point[0])>0.000001 || Math.abs(v.lng-point[1])>0.000001) throw new Error("Feature coordinates do not match its mapped geometry. Select the feature again or place an independent pin.");
  }
  return {lat:v.lat,lng:v.lng,...(v.featureId ? {featureId:v.featureId}:{}),source:v.featureId ? "osm-feature":"user-selected"};
}
export function reportCoordinates(g: { mapLocation?: MapLocation; location: string }): [number,number] | null {
  return g.mapLocation && inSelectionArea(g.mapLocation.lat,g.mapLocation.lng) ? [g.mapLocation.lat,g.mapLocation.lng] : coordsFor(g.location);
}
export const CATEGORY_COLORS: Record<string,string> = {Network:"#56b4e9",Electrical:"#f2a93b",Plumbing:"#4dd4cf",Facilities:"#ba9cff",Academic:"#e6b7d6",Hostel:"#ec9473",Other:"#a2adb9"};
export interface MapReport { _id: string; rawText: string; location: string; category: string; priorityLabel: string; status: string; createdAt: string; isAnonymous: boolean; incident?: string | null; mapLocation?: MapLocation; }
export function filterReports(reports: MapReport[], filters: {category:string;priority:string;status:string}) {
  return reports.filter(g=>(!filters.category || g.category===filters.category)&&(!filters.priority || g.priorityLabel===filters.priority)&&(!filters.status || (filters.status==="open" ? g.status!=="Resolved":g.status===filters.status)));
}
// Screen-space grid groups overlapping points at the current zoom; no fabricated density surface.
export function clusterReports(reports: MapReport[], zoom: number) {
  const groups = new Map<string,{id:string;lat:number;lng:number;reports:MapReport[]}>();
  for (const g of reports) {
    const p = reportCoordinates(g); if (!p) continue;
    const scale=256*2**zoom, sin=Math.sin(p[0]*Math.PI/180);
    const id=`${Math.floor(((p[1]+180)/360*scale)/48)}:${Math.floor(((0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale)/48)}`;
    const group=groups.get(id)||{id,lat:0,lng:0,reports:[]};group.lat+=p[0];group.lng+=p[1];group.reports.push(g);groups.set(id,group);
  }
  return Array.from(groups.values()).map(g=>({...g,lat:g.lat/g.reports.length,lng:g.lng/g.reports.length}));
}
