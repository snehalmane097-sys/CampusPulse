import { NextRequest } from "next/server";
import { handleV2 } from "@/services/v2";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) { return handleV2(req, "attachments", await context.params); }
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) { return handleV2(req, "attachments", await context.params); }
