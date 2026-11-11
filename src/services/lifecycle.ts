import Grievance from "@/models/Grievance";
import { Actor, ApiError } from "@/lib/api";
import { notify, notifyAdmins, emitInbox } from "./notifications";
import { syncIncidentStatus } from "@/lib/incidentEngine";
export function nextResolutionCycle(current: number, oldStatus: string, nextStatus: string) {
  return current + (oldStatus !== "Resolved" && nextStatus === "Resolved" ? 1 : 0);
}
export async function transition(grievance: any, status: string, actor: Actor, session: any, reopening = false) {
  if (!["Pending", "In Progress", "Resolved"].includes(status)) throw new ApiError(400, "Invalid status.");
  if (grievance.status === status) return grievance;
  if (grievance.status === "Resolved" && !reopening) throw new ApiError(409, "Use a reopening request to change a resolved grievance.");
  const cycle = nextResolutionCycle(grievance.resolutionCycle || 0, grievance.status, status);
  const at = new Date();
  const updated = await Grievance.findOneAndUpdate({ _id: grievance._id, status: grievance.status, __v: grievance.__v }, {
    $set: { status, resolutionCycle: cycle, ...(status === "Resolved" ? { resolvedAt: at, resolutionDepartment: grievance.department } : {}) },
    ...(status !== "Resolved" ? { $unset: { resolvedAt: 1 } } : {}),
    $inc: { __v: 1 }, $push: { history: { status, at, actor: actor.userId, cycle, department: grievance.department } },
  }, { new: true, session, runValidators: true });
  if (!updated) throw new ApiError(409, "This grievance changed. Please refresh.");
  const eventKey = `status:${updated._id}:${updated.__v}`;
  if (updated.student) await notify(updated.student, eventKey, `Your grievance is now ${status}.`, { grievance: updated._id, type: "status" }, session);
  await notifyAdmins(eventKey, `Grievance ${String(updated._id).slice(-6)} is now ${status}.`, { grievance: updated._id, type: "status" }, session);
  if (updated.incident) await syncIncidentStatus(String(updated.incident), session);
  return updated;
}
export function emitTransition(g: any) {
  const io = (global as any).__campuspulse_io, payload = { grievanceId: g._id, status: g.status };
  io?.to(`user:${g.student}`).emit("grievance:statusChanged", payload);
  io?.to("admin-room").emit("grievance:statusChanged", payload);
  if (g.incident) io?.to("admin-room").emit("incident:updated", { incidentId: g.incident });
  emitInbox(String(g.student));
}
