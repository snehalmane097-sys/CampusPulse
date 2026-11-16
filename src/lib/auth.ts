import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || /^(change-this|replace-this)/i.test(value)) throw new Error("JWT_SECRET must be a generated secret of at least 32 characters, not the example placeholder.");
  return value;
}

export interface TokenPayload {
  userId: string;
  role: "student" | "admin";
  name: string;
  sessionId?: string;
  exp?: number;
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, secret(), { expiresIn: "1d", algorithm: "HS256", issuer: "campuspulse", audience: "campuspulse" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: "campuspulse", audience: "campuspulse" }) as TokenPayload;
    return typeof payload === "object" && /^[a-f\d]{24}$/i.test(payload.userId) && /^[a-f\d]{24}$/i.test(payload.sessionId || "") && typeof payload.name === "string" && Number.isFinite(payload.exp) && ["student", "admin"].includes(payload.role) ? payload : null;
  } catch {
    return null;
  }
}

export function getTokenFromHeader(header?: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}
