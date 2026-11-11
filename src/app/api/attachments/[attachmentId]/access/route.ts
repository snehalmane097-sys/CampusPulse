import { NextRequest } from "next/server";
import { handleV2 } from "@/services/v2";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, context: { params: Promise<{ attachmentId: string }> }) { return handleV2(req, "access", await context.params); }
