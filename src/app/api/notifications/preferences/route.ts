import { NextRequest } from "next/server";
import { handleV2 } from "@/services/v2";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return handleV2(req, "preferences"); }
export async function PATCH(req: NextRequest) { return handleV2(req, "preferences"); }
