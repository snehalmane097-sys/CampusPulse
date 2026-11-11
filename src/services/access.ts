import Grievance from "@/models/Grievance";
import { Actor, ApiError, id } from "@/lib/api";
export async function grievanceAccess(grievanceId: string, actor: Actor, ownerOnly = false, session?: any) {
  const grievance = await Grievance.findById(id(grievanceId)).session(session || null);
  if (!grievance) throw new ApiError(404, "Grievance not found.");
  if ((ownerOnly || actor.role !== "admin") && String(grievance.student) !== actor.userId) throw new ApiError(403, "You do not have access to this grievance.");
  return grievance;
}
