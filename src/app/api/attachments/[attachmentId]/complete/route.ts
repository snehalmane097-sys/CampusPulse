import { NextRequest } from "next/server";
import { handleV2 } from "@/services/v2";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, context: { params: Promise<{ attachmentId: string }> }) { return handleV2(req, "complete", await context.params); }
