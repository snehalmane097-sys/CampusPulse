import { NextRequest, NextResponse } from "next/server";
import Grievance from "@/models/Grievance";
import { authenticate, fail, body, limit, text, ApiError, transaction, pagination } from "@/lib/api";
import { classifyGrievance } from "@/lib/classification";
import { clusterAndScore, syncIncidentStatus } from "@/lib/incidentEngine";
import { sanitizeGrievanceListForAdmin } from "@/lib/sanitize";
import { notifyAdmins, emitInbox } from "@/services/notifications";
import ClusterLock from "@/models/ClusterLock";
import { createHash } from "crypto";
import { validateMapLocation } from "@/lib/campusMap";
export async function GET(req: NextRequest) {
  try {
    const actor = await authenticate(req), page = pagination(req, 200);
    const grievances = await Grievance.find({ ...(actor.role === "admin" ? {} : { student: actor.userId }), ...page.filter }).sort({ _id: -1 }).limit(page.limit + 1);
    const more = grievances.length > page.limit; if (more) grievances.pop();
    const scope = actor.role === "admin" ? {} : { student: actor.userId };
    const [total, active] = await Promise.all([Grievance.countDocuments(scope), Grievance.countDocuments({ ...scope, status: { $ne: "Resolved" } })]);
    return NextResponse.json({ grievances: actor.role === "admin" ? sanitizeGrievanceListForAdmin(grievances) : grievances, nextCursor: more ? String(grievances.at(-1)!._id) : null, summary: { total, active } });
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest) {
  try {
    const actor = await authenticate(req); await limit(req, "grievance-submit", 10, actor.userId);
    const data = await body(req), rawText = text(data.rawText, "Description", 5, 10000);
    let mapLocation;
    try { mapLocation = validateMapLocation(data.mapLocation); }
    catch(error: any) { throw new ApiError(400, error.message); }
    if ((data.isAnonymous !== undefined && typeof data.isAnonymous !== "boolean") || (data.priorityLabel !== undefined && !["Low","Medium","High","Critical"].includes(data.priorityLabel)) || (data.submittedVia !== undefined && !["text","voice"].includes(data.submittedVia))) throw new ApiError(400, "Invalid grievance fields.");
    const submissionKey = req.headers.get("idempotency-key") || undefined;
    if (submissionKey && !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(submissionKey)) throw new ApiError(400, "Invalid submission key.");
    const submissionHash = createHash("sha256").update(JSON.stringify([rawText, data.isAnonymous || false, data.priorityLabel || "Medium", data.submittedVia || "text", ...(mapLocation ? [mapLocation] : [])])).digest("hex");
    const reuse = (existing: any) => { if (existing.submissionHash && existing.submissionHash !== submissionHash) throw new ApiError(409, "This submission key was already used for different report content. Refresh before starting a new report."); return existing; };
    if (submissionKey) { const existing = await Grievance.findOne({ student: actor.userId, submissionKey }); if (existing) return NextResponse.json({ grievance: reuse(existing) }); }
    const classification = classifyGrievance(rawText);
    const clusterKey = `${classification.category}::${classification.location}`;
    try { await ClusterLock.updateOne({ _id: clusterKey }, { $setOnInsert: { version: 0 } }, { upsert: true }); }
    catch (error: any) { if (error.code !== 11000) throw error; } // A concurrent creator already established this lock.
    const result = await transaction(async session => {
      // A shared write forces concurrent submissions to retry with a fresh clustering snapshot.
      await ClusterLock.updateOne({ _id: clusterKey }, { $inc: { version: 1 } }, { session });
      if (submissionKey) { const existing = await Grievance.findOne({ student: actor.userId, submissionKey }).session(session); if (existing) return { grievance: reuse(existing), created: false }; }
      const [g] = await Grievance.create([{ student: actor.userId, isAnonymous: data.isAnonymous || false, rawText, submittedVia: data.submittedVia || "text", ...classification, priorityLabel: data.priorityLabel || "Medium", status: "Pending", submissionKey, submissionHash, ...(mapLocation ? { mapLocation } : {}) }], { session });
      const scored = await clusterAndScore(g, session);
      g.incident = scored.incidentId as any; g.affectedCount = scored.affectedCount; g.priorityScore = scored.priorityScore; g.priorityLabel = scored.priorityLabel; g.priorityReasons = scored.priorityReasons; await g.save({ session });
      if (g.incident) await syncIncidentStatus(String(g.incident), session);
      await notifyAdmins("grievance:" + g._id, "New " + g.category + " report in " + g.location + ".", { grievance: g._id, type: "new-grievance" }, session);
      return { grievance: g, created: true };
    });
    const grievance = result.grievance;
    if (!result.created) return NextResponse.json({ grievance });
    const io = (global as any).__campuspulse_io;
    io?.to("admin-room").emit("grievance:new", { grievance: sanitizeGrievanceListForAdmin([grievance])[0] });
    if (grievance.incident) io?.to("admin-room").emit("incident:updated", { incidentId: grievance.incident });
    emitInbox();
    return NextResponse.json({ grievance }, { status: 201 });
  } catch (error) { return fail(error); }
}

export const dynamic = "force-dynamic";
