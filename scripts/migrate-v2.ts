import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import User from "@/models/User";
import Grievance from "@/models/Grievance";
import Notification from "@/models/Notification";
import Incident from "@/models/Incident";
import Session from "@/models/Session";
import RateLimit from "@/models/RateLimit";
import Attachment from "@/models/Attachment";
import Announcement from "@/models/Announcement";
import ResolutionFeedback from "@/models/ResolutionFeedback";
import ReopenRequest from "@/models/ReopenRequest";
import OutboxJob from "@/models/OutboxJob";
import EmailVerificationToken from "@/models/EmailVerificationToken";
import { backfillMissingUserFields } from "@/services/migration";
import ClusterLock from "@/models/ClusterLock";
async function main() {
  await dbConnect();
  const models = [User, Grievance, Notification, Incident, Session, RateLimit, Attachment, Announcement, ResolutionFeedback, ReopenRequest, OutboxJob, EmailVerificationToken, ClusterLock];
  const dry = !process.argv.includes("--apply");
  console.log(dry ? "DRY RUN: no writes. Pass --apply after backup." : "Applying additive CampusPulse 2.0 migration.");
  const counts = { users: await User.countDocuments(), grievances: await Grievance.countDocuments(), notifications: await Notification.countDocuments() }; console.log(counts);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("MongoDB replica set or sharded cluster required for transactions.");
  if (!dry) {
    await backfillMissingUserFields();
    await Grievance.updateMany({ resolutionCycle: { $exists: false } }, { resolutionCycle: 0 });
    await Notification.updateMany({ type: { $exists: false } }, { type: "status" });
    // createIndexes is additive: historical indexes are never dropped. Existing resolution dates are never guessed.
    for (const m of models) await m.createIndexes();
  }
  console.log("Migration complete. Legacy resolution dates remain unknown."); await mongoose.disconnect();
}
main().catch(e => { console.error("Migration failed:", e.message); process.exitCode = 1; mongoose.disconnect(); });
