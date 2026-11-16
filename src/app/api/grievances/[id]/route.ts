import { NextRequest, NextResponse } from "next/server";
import { authenticate, body, fail, transaction, limit, text, ApiError } from "@/lib/api";
import { grievanceAccess } from "@/services/access";
import { transition, emitTransition } from "@/services/lifecycle";
import { sanitizeGrievanceForAdmin, sanitizeGrievanceForStudent } from "@/lib/sanitize";
import { withVerifiedOrigins } from "@/services/complaintOrigin";
import BuildingAssignment from "@/models/BuildingAssignment";
import CampusBuilding from "@/models/CampusBuilding";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticate(req), g = await grievanceAccess((await params).id, actor);
    const [grievance] = await withVerifiedOrigins([actor.role === "admin" ? sanitizeGrievanceForAdmin(g) : sanitizeGrievanceForStudent(g)]);
    let buildingChanges;
    if (actor.role === "admin") {
      const changes = await BuildingAssignment.find({ grievance: g._id }).sort({ revision: -1 }).limit(100).lean();
      const ids = changes.flatMap(c => [c.previousBuilding, c.building]).filter(Boolean);
      const buildings = ids.length ? await CampusBuilding.find({ _id: { $in: ids } }).select("_id displayName").lean() : [];
      const name = (value: unknown) => value ? buildings.find(b => String(b._id) === String(value))?.displayName || "Unavailable building" : "Not verified";
      buildingChanges = changes.map(c => ({ revision: c.revision, at: c.at, reason: c.reason, previousBuilding: name(c.previousBuilding), building: name(c.building), previousDepartment: c.previousDepartment || "Not verified", department: c.department || "Not verified" }));
    }
    return NextResponse.json({ grievance, ...(buildingChanges ? { buildingChanges } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fail(e); }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticate(req, true); await limit(req, "status", 60, actor.userId); const data = await body(req);
    const note = data.note === undefined || data.note === "" ? "" : text(data.note, "Investigation note", 1, 2000);
    if (data.expectedVersion !== undefined && (!Number.isInteger(data.expectedVersion) || data.expectedVersion < 0)) throw new ApiError(400, "Invalid complaint version.");
    const result = await transaction(async session => { const g = await grievanceAccess((await params).id, actor, false, session); if (data.expectedVersion !== undefined && data.expectedVersion !== g.__v) throw new ApiError(409, "Complaint changed. Reload before saving."); return { grievance: await transition(g, data.status, actor, session, false, note), changed: g.status !== data.status || !!note }; });
    if (result.changed) emitTransition(result.grievance);
    return NextResponse.json({ grievance: sanitizeGrievanceForAdmin(result.grievance) });
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
