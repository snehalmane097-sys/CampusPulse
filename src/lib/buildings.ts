import { CAMPUS_FEATURES, CampusFeature } from "./campusMap";

export const BUILDING_CATEGORIES = ["Academic", "Laboratory", "Administration", "Canteen", "Library", "Sports", "Other"] as const;
export interface CampusBuilding {
  _id: string; featureId: string; displayName: string; code: string; description: string;
  category: string; approved: boolean; revision: number;
}
export interface BuildingSummary {
  buildingId: string; total: number; open: number; inProgress: number; resolved: number;
  highPriority: number; categories: { category: string; count: number }[];
}
export function managedFeature(featureId: string) {
  return CAMPUS_FEATURES.find(f => f.id === featureId && f.properties.category !== "campus");
}
export function buildingLabel(feature: CampusFeature, buildings: CampusBuilding[]) {
  return buildings.find(b => b.featureId === feature.id && b.approved && b.displayName.trim())?.displayName || null;
}
export function searchableFeature(feature: CampusFeature, buildings: CampusBuilding[]) {
  return !!buildingLabel(feature, buildings);
}
export function approvedCampusFeatures(buildings: CampusBuilding[], search = "") {
  return CAMPUS_FEATURES.filter(f => {
    const building = buildings.find(b => b.featureId === f.id && b.approved && b.displayName.trim());
    return !!building && `${building.displayName} ${building.code} ${building.category}`.toLowerCase().includes(search.trim().toLowerCase());
  });
}
export function buildingInput(data: Record<string, unknown>) {
  const field = (key: string, max: number, required = false) => {
    const value = data[key] ?? "";
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new Error(`Invalid ${key}.`);
    return value.trim();
  };
  const displayName = field("displayName", 120, true), code = field("code", 30), description = field("description", 1200);
  const category = data.category || "Other";
  if (!BUILDING_CATEGORIES.includes(category as any) || typeof data.approved !== "boolean") throw new Error("Invalid category or approval state.");
  return { displayName, nameKey: displayName.normalize("NFKC").toLowerCase(), code, description, category: category as string, approved: data.approved };
}

// Shared by the aggregate and paginated map feed so counts and report drill-down agree.
// Dates denote UTC calendar days. No coordinates are used for association.
export function buildingReportFilter(params: URLSearchParams): Record<string, any> {
  const query: Record<string, any> = {};
  for (const [key, field, allowed] of [
    ["category", "category", ["Network", "Electrical", "Plumbing", "Facilities", "Academic", "Hostel", "Other"]],
    ["priority", "priorityLabel", ["Low", "Medium", "High", "Critical"]],
    ["status", "status", ["open", "Pending", "In Progress", "Resolved"]],
  ] as const) {
    const value = params.get(key);
    if (value) {
      if (!(allowed as readonly string[]).includes(value)) throw new Error(`Invalid ${key} filter.`);
      query[field] = value === "open" ? { $ne: "Resolved" } : value;
    }
  }
  const department = params.get("originDepartment");
  if (department) { if (department.length > 120) throw new Error("Invalid origin department."); query.originDepartment = department; }
  const from = params.get("from"), to = params.get("to");
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD.");
    const date = new Date(value + "T00:00:00.000Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Invalid calendar date.");
    return date;
  };
  if (from || to) {
    const start = from ? day(from) : null, end = to ? day(to) : null;
    if (start && end && start > end) throw new Error("From date must not follow To date.");
    query.createdAt = { ...(start ? { $gte: start } : {}), ...(end ? { $lt: new Date(end.getTime() + 86400000) } : {}) };
  }
  return query;
}
