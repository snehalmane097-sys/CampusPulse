import Notification from "@/models/Notification";
import OutboxJob from "@/models/OutboxJob";
import User from "@/models/User";
export async function notify(user: any, eventKey: string, message: string, options: { grievance?: any; announcement?: any; type?: string; title?: string } = {}, session?: any) {
  if (!user) return; // Historical anonymous records may have no recoverable owner.
  await Notification.updateOne({ user, eventKey }, { $setOnInsert: { user, eventKey, message, ...options, read: false, createdAt: new Date() } }, { upsert: true, session });
  await OutboxJob.updateOne({ key: `email:${user}:${eventKey}` }, { $setOnInsert: { kind: "email", payload: { user: String(user), subject: options.title || "CampusPulse update", message: "You have an update in your CampusPulse inbox." }, state: "pending", availableAt: new Date() } }, { upsert: true, session });
}
export async function notifyAdmins(key: string, message: string, options: any, session?: any) {
  const admins = await User.find({ role: "admin", disabled: { $ne: true } }).select("_id").session(session || null);
  for (const admin of admins) await notify(admin._id, key, message, options, session);
}
export function emitInbox(userId?: string) {
  const io = (global as any).__campuspulse_io;
  if (userId) io?.to(`user:${userId}`).emit("notification:changed");
  io?.to("admin-room").emit("notification:changed");
}
