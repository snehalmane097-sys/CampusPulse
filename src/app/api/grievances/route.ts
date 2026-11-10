import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Grievance from "@/models/Grievance";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";
import { classifyGrievance } from "@/lib/classification";
import { clusterAndScore, syncIncidentStatus } from "@/lib/incidentEngine";
import { sanitizeGrievanceListForAdmin } from "@/lib/sanitize";

// GET /api/grievances — students see their own (including their own
// anonymous ones, since ownership is never dropped); admins see everything
// with anonymous identities stripped before the response is built.
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const query = auth.role === "admin" ? {} : { student: auth.userId };
    const grievances = await Grievance.find(query).sort({ createdAt: -1 }).limit(200);

    const payload = auth.role === "admin" ? sanitizeGrievanceListForAdmin(grievances) : grievances;
    return NextResponse.json({ grievances: payload });
  } catch (err) {
    console.error("GET /api/grievances failed:", err);
    return NextResponse.json({ error: "Could not load grievances right now." }, { status: 500 });
  }
}

// POST /api/grievances — the "Voice -> Text -> Classification -> Priority ->
// Department -> Submit" pipeline described in the PDF.
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { rawText, isAnonymous, priorityLabel, submittedVia } = await req.json();
    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 5) {
      return NextResponse.json({ error: "Please describe the issue in a bit more detail." }, { status: 400 });
    }

    const { category, location, department } = classifyGrievance(rawText);

    // Ownership is always recorded, anonymous or not — "anonymous" controls
    // what admins are shown, not what the database remembers, so the
    // student never loses their own grievance from their dashboard.
    const grievance = await Grievance.create({
      student: auth.userId,
      isAnonymous: !!isAnonymous,
      rawText,
      submittedVia: submittedVia === "voice" ? "voice" : "text",
      category,
      location,
      department,
      priorityLabel: priorityLabel || "Medium",
      status: "Pending",
    });

    const {
      incidentId,
      affectedCount,
      priorityScore,
      priorityLabel: computedLabel,
      priorityReasons,
    } = await clusterAndScore(grievance);

    grievance.incident = incidentId as any;
    grievance.affectedCount = affectedCount;
    grievance.priorityScore = priorityScore;
    grievance.priorityLabel = computedLabel;
    grievance.priorityReasons = priorityReasons;
    await grievance.save();

    if (incidentId) {
      // A brand-new incident starts Pending already; this only matters when
      // the new report joined an incident that had progressed further.
      await syncIncidentStatus(String(incidentId));
    }

    // Real-time push to the admin dashboard. Sanitize before emitting —
    // sockets bypass the GET route's masking, so this is the other half of
    // the anonymous-identity guarantee.
    const io = (global as any).__campuspulse_io;
    if (io) {
      const safeGrievance = sanitizeGrievanceListForAdmin([grievance])[0];
      io.to("admin-room").emit("grievance:new", { grievance: safeGrievance });
      if (incidentId) {
        io.to("admin-room").emit("incident:updated", { incidentId, affectedCount });
      }
    }

    return NextResponse.json({ grievance }, { status: 201 });
  } catch (err) {
    console.error("POST /api/grievances failed:", err);
    return NextResponse.json({ error: "Could not submit your grievance right now." }, { status: 500 });
  }
}
