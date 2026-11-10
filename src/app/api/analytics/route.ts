import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Grievance, { GrievancePriority } from "@/models/Grievance";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";
import { coordsFor } from "@/lib/campusMap";
import { computeEarlyWarnings } from "@/lib/earlyWarning";

const PRIORITY_RANK: Record<GrievancePriority, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const auth = verifyToken(getTokenFromHeader(req.headers.get("authorization")) || "");
    if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const all = await Grievance.find({});
    const total = all.length;
    const resolved = all.filter((g) => g.status === "Resolved");
    const active = total - resolved.length;

    const avgResolutionHours =
      resolved.length === 0
        ? 0
        : Math.round(
            resolved.reduce((sum, g) => {
              const hrs = (g.updatedAt.getTime() - g.createdAt.getTime()) / 36e5;
              return sum + hrs;
            }, 0) / resolved.length
          );

    const categoryCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};
    const trendCounts: Record<string, number> = {};

    // Per-location detail for the radar's click-through view: how many
    // distinct active incidents sit at this location, and the worst
    // priority currently open there.
    const locationIncidents: Record<string, Set<string>> = {};
    const locationHighestPriority: Record<string, GrievancePriority> = {};

    all.forEach((g) => {
      categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
      priorityCounts[g.priorityLabel] = (priorityCounts[g.priorityLabel] || 0) + 1;
      locationCounts[g.location] = (locationCounts[g.location] || 0) + 1;
      const day = g.createdAt.toISOString().slice(0, 10);
      trendCounts[day] = (trendCounts[day] || 0) + 1;

      if (g.status !== "Resolved") {
        if (g.incident) {
          if (!locationIncidents[g.location]) locationIncidents[g.location] = new Set();
          locationIncidents[g.location].add(String(g.incident));
        }
        const current = locationHighestPriority[g.location];
        if (!current || PRIORITY_RANK[g.priorityLabel] > PRIORITY_RANK[current]) {
          locationHighestPriority[g.location] = g.priorityLabel;
        }
      }
    });

    const hotspots = Object.entries(locationCounts).map(([location, count]) => {
      const [lat, lng] = coordsFor(location);
      return {
        location,
        count,
        lat,
        lng,
        activeIncidents: locationIncidents[location]?.size ?? 0,
        highestPriority: locationHighestPriority[location] ?? null,
      };
    });

    const trend = Object.entries(trendCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const earlyWarnings = computeEarlyWarnings(all);

    return NextResponse.json({
      total,
      active,
      resolved: resolved.length,
      avgResolutionHours,
      categoryDistribution: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
      priorityDistribution: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      hotspots,
      trend,
      earlyWarnings,
    });
  } catch (err) {
    console.error("GET /api/analytics failed:", err);
    return NextResponse.json({ error: "Could not load analytics right now." }, { status: 500 });
  }
}
