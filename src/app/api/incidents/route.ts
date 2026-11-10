import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Incident from "@/models/Incident";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const incidents = await Incident.find({ status: { $ne: "Resolved" } })
      .sort({ severityScore: -1 })
      .limit(100);

    return NextResponse.json({ incidents });
  } catch (err) {
    console.error("GET /api/incidents failed:", err);
    return NextResponse.json({ error: "Could not load incidents right now." }, { status: 500 });
  }
}
