import mongoose from "mongoose";
import User from "@/models/User";
import { dbConnect } from "@/lib/mongodb";
async function main() {
  const [email, kind, department] = process.argv.slice(2);
  if (!email || !["academic", "service"].includes(kind) || !department || department.length > 120) throw new Error('Usage: npm run department -- user@campus.edu academic|service "Department"');
  await dbConnect(); const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || (kind === "academic" && user.role !== "student") || (kind === "service" && user.role !== "admin")) throw new Error("Account not found or department type does not match role.");
  if (kind === "academic") user.academicDepartment = department; else user.department = department;
  await user.save(); console.log("Department assignment updated."); await mongoose.disconnect();
}
main().catch(e => { console.error(e.message); process.exitCode = 1; mongoose.disconnect(); });
