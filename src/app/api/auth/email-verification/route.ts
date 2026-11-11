import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticate, body, fail, limit, ApiError, text, transaction } from "@/lib/api";
import EmailVerificationToken from "@/models/EmailVerificationToken";
import User from "@/models/User";
import OutboxJob from "@/models/OutboxJob";
export async function POST(req: NextRequest) {
  try {
    const a = await authenticate(req); await limit(req, "verify-email", 3, a.userId); const data = await body(req);
    if (data.token) {
      const hash = createHash("sha256").update(text(data.token, "Verification token", 64, 64)).digest("hex");
      await transaction(async session => {
        const token = await EmailVerificationToken.findOneAndDelete({ user: a.userId, hash, expiresAt: { $gt: new Date() } }, { session });
        if (!token) throw new ApiError(400, "Verification token is invalid or expired.");
        await User.updateOne({ _id: a.userId }, { emailVerified: true }, { session });
      });
      return NextResponse.json({ message: "Email address verified." });
    }
    if (a.user.emailVerified) return NextResponse.json({ message: "Email address is already verified." });
    const token = randomBytes(32).toString("hex"), hash = createHash("sha256").update(token).digest("hex");
    await transaction(async session => {
      await EmailVerificationToken.deleteMany({ user: a.userId }, { session });
      await EmailVerificationToken.create([{ user: a.userId, hash, expiresAt: new Date(Date.now() + 3600000) }], { session });
      // Touch the account to serialize concurrent replacement requests as well as token deletion.
      await User.updateOne({ _id: a.userId }, { $inc: { __v: 1 } }, { session });
      await OutboxJob.create([{ key: `verification:${hash}`, kind: "email", payload: { user: a.userId, verification: true, verificationHash: hash, subject: "Verify your CampusPulse email", message: `Your verification code is ${token}. Paste it in notification preferences. It expires in one hour.` } }], { session });
    });
    return NextResponse.json({ message: "Verification email queued. In local development, check private mail output after the worker runs." });
  } catch (e) { return fail(e); }
}

export const dynamic = "force-dynamic";
