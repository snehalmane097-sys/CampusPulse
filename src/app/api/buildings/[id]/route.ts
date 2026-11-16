import { NextRequest, NextResponse } from "next/server";
import CampusBuilding from "@/models/CampusBuilding";
import { authenticate, body, fail, ApiError, id, limit } from "@/lib/api";
import { buildingInput } from "@/lib/buildings";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticate(req, true); await limit(req, "building-manage", 40, actor.userId);
    const key = id((await params).id), data = await body(req);
    if (!Number.isInteger(data.revision) || data.revision < 0) throw new ApiError(400, "A valid revision is required.");
    if (data.featureId !== undefined || data.geometry !== undefined) throw new ApiError(400, "Source geometry cannot be edited here.");
    let fields; try { fields = buildingInput(data); } catch (error: any) { throw new ApiError(400, error.message); }
    const updated = await CampusBuilding.findOneAndUpdate({ _id: key, revision: data.revision }, { $set: fields, $inc: { revision: 1 } }, { new: true, runValidators: true });
    if (!updated) throw new ApiError(409, "Building changed or is unavailable. Refresh before editing again.");
    return NextResponse.json({ id: String(updated._id), revision: updated.revision });
  } catch (error) { return fail(error); }
}
export const dynamic = "force-dynamic";
