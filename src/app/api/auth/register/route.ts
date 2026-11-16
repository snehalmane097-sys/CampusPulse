import { NextRequest } from "next/server";
import User from "@/models/User";
import { hashPassword } from "@/lib/auth";
import { ApiError, body, fail, limit, text, passwordText, assertSameOrigin } from "@/lib/api";
import { loginResponse } from "@/services/session";
import { createHash } from "crypto";
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const data = await body(req), name = text(data.name, "Name", 2, 120), email = text(data.email, "Email", 3, 254).toLowerCase(), password = passwordText(data.password, 10);
    await limit(req, "register-network", 1000);
    await limit(req, "register-account", 5, createHash("sha256").update(email).digest("hex"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address.");
    if (Buffer.byteLength(password) > 72) throw new ApiError(400, "Password must be at most 72 UTF-8 bytes.");
    if (await User.exists({ email })) throw new ApiError(409, "An account with this email already exists.");
    const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: "student" });
    return await loginResponse(user, req.cookies.get("cp_session")?.value);
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
