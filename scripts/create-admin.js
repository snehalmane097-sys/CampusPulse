/**
 * Manually provision (or promote) an admin account.
 *
 * This is deliberately NOT an API route. Admin creation must never be
 * reachable over HTTP from the public app — that's the exact hole this
 * script exists to replace. Run it by hand, from a trusted machine, against
 * your own MONGODB_URI.
 *
 * Usage:
 *   node scripts/create-admin.js "Full Name" admin@campus.edu "a-strong-password" "IT / Network"
 *
 * - If no user exists with that email, a new admin account is created.
 * - If a user already exists with that email, they are promoted to admin
 *   (their existing password is left untouched unless you pass a new one
 *   as the 3rd argument AND confirm with --reset-password).
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Tiny manual .env.local reader — avoids adding a `dotenv` dependency just
// for this one script. KEY=VALUE lines only, no quoting/escaping support.
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const [, , name, email, password, department] = process.argv;
  const resetPassword = process.argv.includes("--reset-password");

  if (!name || !email || !password) {
    console.error(
      'Usage: node scripts/create-admin.js "Full Name" admin@campus.edu "password" ["Department"]'
    );
    process.exit(1);
  }
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to .env.local first.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  // Minimal inline schema mirroring src/models/User.ts — kept separate on
  // purpose so this script has no dependency on the Next.js app's TS build.
  const User = mongoose.models.User || mongoose.model(
    "User",
    new mongoose.Schema({
      name: String,
      email: { type: String, unique: true, lowercase: true },
      passwordHash: String,
      role: { type: String, enum: ["student", "admin"], default: "student" },
      department: String,
      createdAt: { type: Date, default: Date.now },
    })
  );

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    if (existing.role === "admin") {
      console.log(`"${email}" is already an admin. Nothing to do.`);
    } else {
      existing.role = "admin";
      if (department) existing.department = department;
      if (resetPassword) existing.passwordHash = await bcrypt.hash(password, 10);
      await existing.save();
      console.log(`Promoted existing user "${email}" to admin.`);
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ name, email: email.toLowerCase(), passwordHash, role: "admin", department });
    console.log(`Created new admin account for "${email}".`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to provision admin:", err);
  process.exit(1);
});
