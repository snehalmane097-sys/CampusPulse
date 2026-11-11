import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Incident from "@/models/Incident";
import { authenticate, fail, body, id, limit } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const incidents = await Incident.find({ status: { $ne: "Resolved" } })
      .sort({ severityScore: -1 })
      .limit(100);

    return NextResponse.json({ incidents });
  } catch (err) {
    return fail(err);
  }
}

export const dynamic = "force-dynamic";
