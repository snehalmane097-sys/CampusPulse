import Grievance, { IGrievance } from "@/models/Grievance";
import Incident, { IIncident } from "@/models/Incident";
import { isLikelyDuplicate } from "@/lib/similarity";
import { calculatePriorityScore, scoreToLabel, explainPriority } from "@/lib/priority";

// Looks back over recent unresolved grievances in the same category/location
// to see whether this new one describes the same underlying problem. If so,
// folds it into that Incident (creating one on first match) rather than
// leaving every report as an independent ticket — this is the PDF's core USP.
export async function clusterAndScore(grievance: IGrievance, session?: any) {
  const candidates = await Grievance.find({
    _id: { $ne: grievance._id },
    category: grievance.category,
    location: grievance.location,
    status: { $ne: "Resolved" },
    createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 72) }, // last 72h
  }).sort({ createdAt: -1 }).limit(50).session(session || null);

  const related = candidates.filter((c) => isLikelyDuplicate(grievance, c));

  let incidentId = null;
  let affectedCount = 1;

  if (related.length > 0) {
    // Reuse an existing incident if any related grievance already has one.
    let existingIncident: any = null;
    for (const relatedId of Array.from(new Set(related.filter(r => r.incident).map(r => String(r.incident))))) {
      existingIncident = await Incident.findById(relatedId).session(session || null);
      if (existingIncident) break;
    }

    affectedCount = related.length + 1;

    if (existingIncident) {
      const incident = existingIncident;
      if (incident) {
        const ids = new Set(incident.grievances.map(String));
        for (const candidate of [grievance, ...related.filter(r => !r.incident || String(r.incident) === String(incident._id))]) if (!ids.has(String(candidate._id))) { incident.grievances.push(candidate._id as any); ids.add(String(candidate._id)); }
        incident.grievanceCount = incident.grievances.length;
        affectedCount = incident.grievanceCount;
        incident.severityScore = Math.min(100, incident.severityScore + 6);
        await incident.save({ session });
        incidentId = incident._id;
        // Backfill: link any related grievance that wasn't attached yet.
        await Grievance.updateMany(
          { _id: { $in: related.map((r) => r._id) }, incident: null },
          { $set: { incident: incident._id } }, { session }
        );
      }
    } else {
      const [incident] = await Incident.create([{
        title: `${grievance.location} ${grievance.category} Issue`,
        category: grievance.category,
        location: grievance.location,
        department: grievance.department,
        grievances: [grievance._id, ...related.map((r) => r._id)],
        grievanceCount: related.length + 1,
        severityScore: 40,
        status: "Pending",
      }], { session });
      incidentId = incident._id;
      await Grievance.updateMany(
        { _id: { $in: related.map((r) => r._id) } },
        { $set: { incident: incident._id } }, { session }
      );
    }
  }

  const priorityInput = {
    category: grievance.category,
    studentSeverity: grievance.priorityLabel,
    affectedCount,
    hoursUnresolved: 0,
  };
  const priorityScore = calculatePriorityScore(priorityInput);

  return {
    incidentId,
    affectedCount,
    priorityScore,
    priorityLabel: scoreToLabel(priorityScore),
    priorityReasons: explainPriority(priorityInput),
  };
}

// Keeps an Incident's status derived from its own grievances rather than
// letting it drift: Resolved only once every linked grievance is resolved,
// In Progress as soon as any one of them is, Pending otherwise. Called after
// any grievance status change. Returns the updated incident, or null if
// nothing changed (so callers can skip an unnecessary socket emit).
export async function syncIncidentStatus(incidentId: string, session?: any) {
  const incident = await Incident.findById(incidentId).populate<{ grievances: IGrievance[] }>(
    "grievances"
  ).session(session || null);
  if (!incident) return null;

  const statuses = incident.grievances.filter(Boolean).map((g: any) => g.status as string);
  let nextStatus: IIncident["status"] = "Pending";
  if (statuses.length > 0 && statuses.every((s) => s === "Resolved")) {
    nextStatus = "Resolved";
  } else if (statuses.some((s) => s === "In Progress" || s === "Resolved")) {
    nextStatus = "In Progress";
  }

  if (incident.status === nextStatus) return null;

  incident.status = nextStatus;
  await incident.save({ session });
  return incident;
}
