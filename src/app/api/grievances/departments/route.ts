import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Grievance from "@/models/Grievance";
import { authenticate, fail, ApiError } from "@/lib/api";
import { buildingReportFilter } from "@/lib/buildings";
export async function GET(req: NextRequest) {
  try {
    const actor = await authenticate(req);
    let filters; try { filters = buildingReportFilter(req.nextUrl.searchParams); } catch (error: any) { throw new ApiError(400, error.message); }
    // Keep all department choices available when one department is selected.
    delete filters.originDepartment;
    const departments = await Grievance.aggregate([
      { $match: { ...filters, ...(actor.role === "admin" ? {} : { student: new mongoose.Types.ObjectId(actor.userId) }) } },
      { $group: { _id: { $ifNull: ["$originDepartment", ""] }, total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
        highPriority: { $sum: { $cond: [{ $in: ["$priorityLabel", ["High", "Critical"]] }, 1, 0] } },
      } }, { $sort: { total: -1, _id: 1 } },
      { $project: { _id: 0, department: "$_id", total: 1, pending: 1, inProgress: 1, resolved: 1, highPriority: 1 } },
    ]);
    return NextResponse.json({ departments, scope: actor.role === "admin" ? "all-authorized" : "own-reports" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export const dynamic = "force-dynamic";
