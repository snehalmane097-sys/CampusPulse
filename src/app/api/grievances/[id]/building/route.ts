import { NextRequest, NextResponse } from "next/server";
import { authenticate, body, fail, transaction, limit, ApiError, id, text } from "@/lib/api";
import { grievanceAccess } from "@/services/access";
import Grievance from "@/models/Grievance";
import CampusBuilding from "@/models/CampusBuilding";
import BuildingAssignment from "@/models/BuildingAssignment";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticate(req, true); await limit(req, "building-assignment", 40, actor.userId);
    const data = await body(req), grievanceId = id((await params).id);
    if (data.buildingId !== null && typeof data.buildingId !== "string") throw new ApiError(400, "Choose an approved building or explicitly clear the association.");
    const buildingId = data.buildingId === null ? null : id(data.buildingId);
    if (!Number.isInteger(data.expectedRevision) || data.expectedRevision < 0) throw new ApiError(400, "A valid association revision is required. Refresh this grievance.");
    const reason = text(data.reason, "Verification reason", 3, 1000);
    const department = data.originDepartment === undefined ? undefined : data.originDepartment === null || data.originDepartment === "" ? "" : text(data.originDepartment, "Origin department", 1, 120);
    const result = await transaction(async session => {
      const g = await grievanceAccess(grievanceId, actor, false, session);
      const revision = g.buildingRevision || 0, previous = g.building ? String(g.building) : null;
      if (revision !== data.expectedRevision) throw new ApiError(409, "This building association changed. Reload the grievance before saving.");
      if (buildingId && !await CampusBuilding.exists({ _id: buildingId, approved: true }).session(session)) throw new ApiError(400, "Select an approved campus building.");
      const nextDepartment = department === undefined ? g.originDepartment || "" : department;
      if (previous === buildingId && nextDepartment === (g.originDepartment || "")) return { changed: false, student: g.student, revision };
      const updated = await Grievance.updateOne({ _id: g._id, ...(revision === 0 ? { $or: [{ buildingRevision: 0 }, { buildingRevision: { $exists: false } }] } : { buildingRevision: revision }) }, {
        $set: { ...(buildingId ? { building: buildingId } : {}), ...(nextDepartment ? { originDepartment: nextDepartment } : {}) },
        $unset: { ...(!buildingId ? { building: 1 } : {}), ...(!nextDepartment ? { originDepartment: 1 } : {}) }, $inc: { buildingRevision: 1, __v: 1 },
      }, { session, runValidators: true });
      if (!updated.modifiedCount) throw new ApiError(409, "The grievance changed. Reload before saving.");
      await BuildingAssignment.create([{ grievance: g._id, previousBuilding: g.building, ...(buildingId ? { building: buildingId } : {}), previousDepartment: g.originDepartment, department: nextDepartment || undefined, actor: actor.userId, reason, revision: revision + 1 }], { session });
      return { changed: true, student: g.student, revision: revision + 1 };
    });
    if (result.changed) {
      const io = (global as any).__campuspulse_io, event = { grievanceId };
      io?.to("admin-room").emit("grievance:buildingChanged", event);
      if (result.student) io?.to(`user:${result.student}`).emit("grievance:buildingChanged", event);
    }
    return NextResponse.json({ buildingId, buildingRevision: result.revision }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export const dynamic = "force-dynamic";
