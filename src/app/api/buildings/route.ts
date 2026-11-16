import { NextRequest, NextResponse } from "next/server";
import CampusBuilding from "@/models/CampusBuilding";
import { authenticate, body, fail, ApiError, limit } from "@/lib/api";
import { buildingInput, managedFeature } from "@/lib/buildings";

export async function GET(req: NextRequest) {
  try {
    const actor = await authenticate(req);
    const buildings = await CampusBuilding.find(actor.role === "admin" ? {} : { approved: true })
      .select("_id featureId displayName code description category approved revision").sort({ displayName: 1 }).lean();
    return NextResponse.json({ buildings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest) {
  try {
    const actor = await authenticate(req, true); await limit(req, "building-manage", 40, actor.userId);
    const data = await body(req);
    if (typeof data.featureId !== "string" || !managedFeature(data.featureId)) throw new ApiError(400, "Select an existing mapped campus feature.");
    let fields; try { fields = buildingInput(data); } catch (error: any) { throw new ApiError(400, error.message); }
    const building = await CampusBuilding.create({ featureId: data.featureId, ...fields });
    return NextResponse.json({ id: String(building._id) }, { status: 201 });
  } catch (error) { return fail(error); }
}
export const dynamic = "force-dynamic";
