import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import User from "@/models/User";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    // Public registration is student-only. `role` is deliberately never
    // read from the request body — accepting a client-supplied role would
    // let anyone create an admin account by hand-crafting the request
    // (Postman, curl, devtools), regardless of what the UI offers. Admin
    // accounts are provisioned directly in the database, out of band.
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "student",
    });

    const token = signToken({ userId: user._id.toString(), role: user.role, name: user.name });
    return NextResponse.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    console.error("POST /api/auth/register failed:", err);
    return NextResponse.json({ error: "Could not create your account right now." }, { status: 500 });
  }
}
