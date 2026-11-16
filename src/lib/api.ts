import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "./mongodb";
import { getTokenFromHeader, verifyToken } from "./auth";
import User from "@/models/User";
import Session from "@/models/Session";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function text(value: unknown, label: string, min = 1, max = 2000): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new ApiError(400, `${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function id(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new ApiError(400, "Invalid resource ID.");
  return value;
}
export function passwordText(value: unknown, min = 1) {
  if (typeof value !== "string" || value.length < min || Buffer.byteLength(value) > 72) throw new ApiError(400, `Password must contain at least ${min} characters and at most 72 UTF-8 bytes.`);
  return value;
}
export async function body(req: NextRequest) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApiError(415, "Content-Type must be application/json.");
  if (Number(req.headers.get("content-length")) > 32768) throw new ApiError(413, "Request too large.");
  const reader = req.body?.getReader();
  const chunks: Buffer[] = []; let bytes = 0;
  if (reader) for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 32768) { await reader.cancel(); throw new ApiError(413, "Request too large."); } chunks.push(Buffer.from(part.value)); }
  const raw = Buffer.concat(chunks).toString("utf8");
  try { const data = JSON.parse(raw); if (!data || Array.isArray(data) || typeof data !== "object") throw 0; return data; }
  catch { throw new ApiError(400, "A valid JSON object is required."); }
}
export type Actor = { userId: string; role: "student" | "admin"; name: string; user: any; sessionId: string };
export function assertSameOrigin(req: NextRequest, required = false) {
  const origin = req.headers.get("origin"), expected = process.env.APP_ORIGIN || req.nextUrl.origin;
  if ((required && !origin) || (origin && origin !== expected) || req.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "Request origin is not allowed.");
}
export async function authenticate(req: NextRequest, admin = false): Promise<Actor> {
  const token = req.cookies.get("cp_session")?.value || getTokenFromHeader(req.headers.get("authorization")) || "";
  const payload = verifyToken(token);
  if (!payload?.sessionId) throw new ApiError(401, "Please sign in again.");
  // Cookie authenticated writes require a same-origin browser request.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.cookies.has("cp_session")) {
    assertSameOrigin(req, true);
  }
  await dbConnect();
  const [session, user] = await Promise.all([
    Session.findOne({ _id: payload.sessionId, user: payload.userId, expiresAt: { $gt: new Date() } }),
    User.findById(payload.userId),
  ]);
  if (!session || !user || user.disabled) throw new ApiError(401, "Your session has ended. Please sign in again.");
  if (admin && user.role !== "admin") throw new ApiError(403, "Administrator access required.");
  return { userId: String(user._id), role: user.role, name: user.name, user, sessionId: String(session._id) };
}
export async function transaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => fn(session)) as T; }
  finally { await session.endSession(); }
}
export function fail(error: any) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error?.code === 11000) return NextResponse.json({ error: "This action has already been recorded. Refresh and try again." }, { status: 409 });
  if (error?.name === "ValidationError" || error?.name === "CastError") return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  console.error("Request failed:", error?.name, error?.code); // Never log credentials or report contents.
  return NextResponse.json({ error: "The operation could not be completed. Please retry." }, { status: 503 });
}
export function pagination(req: NextRequest, max = 50) {
  const limit = Math.max(1, Math.min(max, Math.floor(Number(req.nextUrl.searchParams.get("limit")) || 20)));
  const cursor = req.nextUrl.searchParams.get("cursor");
  return { limit, filter: cursor ? { _id: { $lt: id(cursor) } } : {} };
}
export async function limit(req: NextRequest, action: string, count: number, actor?: string) {
  // Mongo-backed counters work across API processes. Do not trust arbitrary forwarded IPs.
  const { default: RateLimit } = await import("@/models/RateLimit");
  await dbConnect();
  const source = actor || (process.env.TRUST_PROXY === "true" ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : "public");
  const window = Math.floor(Date.now() / 60000);
  let entry;
  try { entry = await RateLimit.findOneAndUpdate({ key: `${action}:${source}:${window}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 120000) } }, { upsert: true, new: true }); }
  catch (e: any) { if (e.code === 11000) throw new ApiError(429, "Too many requests. Please wait a minute."); throw e; }
  if (entry.count > count) throw new ApiError(429, "Too many requests. Please wait a minute.");
}
