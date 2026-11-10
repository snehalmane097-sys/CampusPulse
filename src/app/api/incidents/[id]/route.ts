import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Incident from "@/models/Incident";
import Grievance from "@/models/Grievance";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";

// GET /api/incidents/:id — admin-only detail view listing every grievance
// clustered under this incident, so the dashboard can visibly show
// "N student complaints -> 1 campus incident" per the clustering-display
// requirement. Anonymous reports are included but never carry student data.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const incident = await Incident.findById(params.id);
    if (!incident) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const reports = await Grievance.find({ _id: { $in: incident.grievances } })
      .select("rawText status priorityLabel priorityScore priorityReasons isAnonymous createdAt")
      .sort({ createdAt: 1 });

    return NextResponse.json({
      incident: {
        _id: incident._id,
        title: incident.title,
        category: incident.category,
        location: incident.location,
        department: incident.department,
        status: incident.status,
        severityScore: incident.severityScore,
        grievanceCount: incident.grievanceCount,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        reports,
      },
    });
  } catch (err) {
    console.error("GET /api/incidents/[id] failed:", err);
    return NextResponse.json({ error: "Could not load this incident right now." }, { status: 500 });
  }
}
