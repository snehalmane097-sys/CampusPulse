import { NextRequest, NextResponse } from "next/server";
import { authenticate, fail } from "@/lib/api";
import { publicUser } from "@/services/session";
export async function GET(req: NextRequest) { try { const a = await authenticate(req); return NextResponse.json({ user: publicUser(a.user) }, { headers: { "Cache-Control": "no-store" } }); } catch (e) { return fail(e); } }

export const dynamic = "force-dynamic";
