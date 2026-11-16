import { NextRequest } from "next/server";
import { handleV2 } from "@/services/v2";
export const dynamic = "force-dynamic";
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) { return handleV2(req, "announcement", await context.params); }
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) { return handleV2(req, "announcement", await context.params); }
