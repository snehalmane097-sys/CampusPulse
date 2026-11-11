import { NextRequest, NextResponse } from "next/server";
import { authenticate, body, fail, transaction, limit } from "@/lib/api";
import { grievanceAccess } from "@/services/access";
import { transition, emitTransition } from "@/services/lifecycle";
import { sanitizeGrievanceForAdmin } from "@/lib/sanitize";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await authenticate(req), g = await grievanceAccess((await params).id, actor); return NextResponse.json({ grievance: actor.role === "admin" ? sanitizeGrievanceForAdmin(g) : g }); } catch (e) { return fail(e); }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticate(req, true); await limit(req, "status", 60, actor.userId); const data = await body(req);
    const result = await transaction(async session => { const g = await grievanceAccess((await params).id, actor, false, session); return { grievance: await transition(g, data.status, actor, session), changed: g.status !== data.status }; });
    if (result.changed) emitTransition(result.grievance);
    return NextResponse.json({ grievance: sanitizeGrievanceForAdmin(result.grievance) });
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
