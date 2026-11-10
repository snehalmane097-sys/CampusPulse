import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Grievance from "@/models/Grievance";
import Notification from "@/models/Notification";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";
import { syncIncidentStatus } from "@/lib/incidentEngine";
import { sanitizeGrievanceForAdmin } from "@/lib/sanitize";

// GET /api/grievances/:id — a student may only fetch their own grievance;
// an admin may fetch any, with the identity masked if it's anonymous.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const grievance = await Grievance.findById(params.id);
    if (!grievance) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (auth.role !== "admin" && String(grievance.student) !== auth.userId) {
      return NextResponse.json({ error: "You don't have access to this grievance." }, { status: 403 });
    }

    const payload = auth.role === "admin" ? sanitizeGrievanceForAdmin(grievance) : grievance;
    return NextResponse.json({ grievance: payload });
  } catch (err) {
    console.error("GET /api/grievances/[id] failed:", err);
    return NextResponse.json({ error: "Could not load this grievance right now." }, { status: 500 });
  }
}

// PATCH /api/grievances/:id — admin moves Pending -> In Progress -> Resolved.
// Keeps the linked Incident's status in sync and pushes both the personal
// and admin-room real-time updates.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Only administrators can update status." }, { status: 403 });
    }

    const { status } = await req.json();
    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const grievance = await Grievance.findByIdAndUpdate(params.id, { status }, { new: true });
    if (!grievance) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (grievance.student) {
      await Notification.create({
        user: grievance.student,
        grievance: grievance._id,
        message: `Your grievance is now "${status}".`,
      });
    }

    let updatedIncident = null;
    if (grievance.incident) {
      updatedIncident = await syncIncidentStatus(String(grievance.incident));
    }

    const io = (global as any).__campuspulse_io;
    if (io) {
      if (grievance.student) {
        io.to(`user:${grievance.student}`).emit("grievance:statusChanged", {
          grievanceId: grievance._id,
          status,
        });
      }
      io.to("admin-room").emit("grievance:statusChanged", { grievanceId: grievance._id, status });
      if (updatedIncident) {
        io.to("admin-room").emit("incident:updated", {
          incidentId: updatedIncident._id,
          status: updatedIncident.status,
        });
      }
    }

    return NextResponse.json({ grievance, incident: updatedIncident });
  } catch (err) {
    console.error("PATCH /api/grievances/[id] failed:", err);
    return NextResponse.json({ error: "Could not update this grievance right now." }, { status: 500 });
  }
}
