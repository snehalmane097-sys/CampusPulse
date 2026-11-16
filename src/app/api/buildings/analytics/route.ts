import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import CampusBuilding from "@/models/CampusBuilding";
import Grievance from "@/models/Grievance";
import { authenticate, fail, ApiError } from "@/lib/api";
import { buildingReportFilter } from "@/lib/buildings";

export async function GET(req: NextRequest) {
  try {
    const actor = await authenticate(req);
    let filters; try { filters = buildingReportFilter(req.nextUrl.searchParams); } catch (error: any) { throw new ApiError(400, error.message); }
    const buildings = await CampusBuilding.find(actor.role === "admin" ? {} : { approved: true }).select("_id").lean();
    const rows = await Grievance.aggregate([
      { $match: { ...filters, building: { $in: buildings.map(b => b._id) }, ...(actor.role === "admin" ? {} : { student: new mongoose.Types.ObjectId(actor.userId) }) } },
      { $group: { _id: { building: "$building", category: "$category" }, total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
        highPriority: { $sum: { $cond: [{ $in: ["$priorityLabel", ["High", "Critical"]] }, 1, 0] } },
      } },
    ]);
    const summaries = buildings.map(b => {
      const groups = rows.filter(r => String(r._id.building) === String(b._id));
      const sum = (key: string) => groups.reduce((n, r) => n + r[key], 0);
      return { buildingId: String(b._id), total: sum("total"), open: sum("open"), inProgress: sum("inProgress"), resolved: sum("resolved"), highPriority: sum("highPriority"), categories: groups.map(r => ({ category: r._id.category || "Other", count: r.total })) };
    });
    return NextResponse.json({ scope: actor.role === "admin" ? "all-authorized" : "own-reports", summaries }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export const dynamic = "force-dynamic";
