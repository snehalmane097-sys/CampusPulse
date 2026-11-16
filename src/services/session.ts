import { NextResponse } from "next/server";
import Session from "@/models/Session";
import { signToken, verifyToken } from "@/lib/auth";
export function publicUser(user: any) { return { id: String(user._id), name: user.name, role: user.role, academicDepartment: user.academicDepartment || "", emailVerified: !!user.emailVerified }; }
export async function loginResponse(user: any, previousToken?: string) {
  // Account switching must not leave the old browser socket/session authorized.
  const previous = previousToken ? verifyToken(previousToken) : null;
  if (previous?.sessionId) {
    await Session.deleteOne({ _id: previous.sessionId, user: previous.userId });
    (global as any).__campuspulse_io?.in(`session:${previous.sessionId}`).disconnectSockets(true);
  }
  const session = await Session.create({ user: user._id, expiresAt: new Date(Date.now() + 86400000) });
  const token = signToken({ userId: String(user._id), role: user.role, name: user.name, sessionId: String(session._id) });
  const response = NextResponse.json({ token: "cookie-session", user: publicUser(user) });
  response.cookies.set("cp_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 86400 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
