import { NextRequest, NextResponse } from "next/server";
import { authenticate, fail, assertSameOrigin, ApiError } from "@/lib/api";
import Session from "@/models/Session";
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req, req.cookies.has("cp_session"));
    try {
      const a = await authenticate(req); await Session.deleteOne({ _id: a.sessionId });
      (global as any).__campuspulse_io?.in(`session:${a.sessionId}`).disconnectSockets(true);
    } catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    const res = NextResponse.json({ success: true }); res.cookies.set("cp_session", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" }); return res;
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
