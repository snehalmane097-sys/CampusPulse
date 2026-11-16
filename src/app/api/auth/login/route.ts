import { NextRequest } from "next/server";
import User from "@/models/User";
import { verifyPassword } from "@/lib/auth";
import { ApiError, body, fail, limit, text, passwordText, assertSameOrigin } from "@/lib/api";
import { loginResponse } from "@/services/session";
import { createHash } from "crypto";
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const data = await body(req), email = text(data.email, "Email", 3, 254).toLowerCase(), password = passwordText(data.password);
    await limit(req, "login-network", 1000);
    await limit(req, "login-account", 20, createHash("sha256").update(email).digest("hex"));
    const user = await User.findOne({ email });
    if (!user || user.disabled || !await verifyPassword(password, user.passwordHash)) throw new ApiError(401, "Invalid email or password.");
    return await loginResponse(user, req.cookies.get("cp_session")?.value);
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
