import { randomUUID, createHash } from "crypto";
import Attachment from "@/models/Attachment";
import Announcement from "@/models/Announcement";
import Grievance from "@/models/Grievance";
import User from "@/models/User";
import OutboxJob from "@/models/OutboxJob";
import { transaction } from "@/lib/api";
import { getObject, newKey, putObject, deleteObject } from "@/lib/storage";
import { scan } from "@/lib/scanner";
import { detectedMime } from "@/lib/uploadPolicy";
import { validateMedia } from "@/lib/mediaValidation";
import { sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "./notifications";
import { announcementAudience } from "./v2";
import EmailVerificationToken from "@/models/EmailVerificationToken";
export { cleanupEvidence } from "./evidenceLifecycle";

export class LeaseLostError extends Error {}
export async function fenceJob(job: any, token: string, session?: any) {
  const result = await OutboxJob.updateOne({ _id: job._id, state: "running", leaseToken: token, leaseUntil: { $gt: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 300000) } }, { session });
  if (!result?.matchedCount) throw new LeaseLostError("Worker lease was lost.");
}

export function stripImageMetadata(data: Buffer, mime: string): Buffer {
  if (mime === "image/jpeg") {
    const chunks = [data.subarray(0, 2)]; let offset = 2;
    while (offset < data.length) {
      if (data[offset] !== 255) throw new Error("Invalid JPEG structure.");
      const marker = data[offset + 1];
      if (marker === 0xda || marker === 0xd9) { chunks.push(data.subarray(offset)); break; }
      const length = data.readUInt16BE(offset + 2); if (length < 2 || offset + 2 + length > data.length) throw new Error("Invalid JPEG segment.");
      if (![0xe1, 0xed, 0xfe].includes(marker)) chunks.push(data.subarray(offset, offset + 2 + length));
      offset += 2 + length;
    }
    return Buffer.concat(chunks);
  }
  if (mime === "image/png") {
    const chunks = [data.subarray(0, 8)]; let offset = 8;
    while (offset < data.length) {
      const size = data.readUInt32BE(offset), end = offset + size + 12; if (end > data.length) throw new Error("Invalid PNG chunk.");
      const type = data.toString("ascii", offset + 4, offset + 8);
      if (!["eXIf", "tEXt", "zTXt", "iTXt", "tIME"].includes(type)) chunks.push(data.subarray(offset, end));
      offset = end;
    }
    return Buffer.concat(chunks);
  }
  if (mime === "image/webp") {
    const chunks: Buffer[] = []; let offset = 12;
    while (offset < data.length) {
      const size = data.readUInt32LE(offset + 4), end = offset + 8 + size + (size % 2); if (end > data.length) throw new Error("Invalid WebP chunk.");
      const type = data.toString("ascii", offset, offset + 4);
      if (!["EXIF", "XMP "].includes(type)) { const chunk = Buffer.from(data.subarray(offset, end)); if (type === "VP8X") chunk[8] &= ~12; chunks.push(chunk); }
      offset = end;
    }
    const header = Buffer.from(data.subarray(0,12)), payload = Buffer.concat(chunks); header.writeUInt32LE(payload.length + 4, 4); return Buffer.concat([header, payload]);
  }
  return data;
}
export async function processScan(job: any, token: string) {
  const a = await Attachment.findById(job.payload.attachment);
  if (!a || a.state !== "processing") return;
  const bytes = await getObject(a.key, a.size);
  let rejection = "";
  if (bytes.length !== a.size || createHash("sha256").update(bytes).digest("hex") !== a.checksum) rejection = "File size or checksum verification failed.";
  if (detectedMime(bytes) !== a.mime) rejection = "File content does not match the declared format.";
  if (!rejection) { try { validateMedia(bytes, a.mime); } catch (e: any) { rejection = e.message; } }
  const result = rejection ? "infected" : await scan(bytes);
  if (result === "infected") rejection ||= "File rejected by security checks.";
  let cleanBytes: Buffer | undefined;
  if (!rejection) { try { cleanBytes = stripImageMetadata(bytes, a.mime); } catch { rejection = "Invalid image metadata structure."; } }
  // Persist a candidate key before storage I/O. A crash cannot leave an untracked clean object.
  const cleanKey = !rejection ? await transaction(async session => {
    await fenceJob(job, token, session);
    const current = await Attachment.findById(a._id).session(session);
    if (!current || current.state !== "processing") return null;
    if (!current.processingKey) { current.processingKey = newKey("clean"); await current.save({ session }); }
    return current.processingKey as string;
  }) : null;
  if (!rejection && !cleanKey) return;
  if (cleanKey) await putObject(cleanKey, cleanBytes!, a.mime, true);
  await transaction(async session => {
      await fenceJob(job, token, session);
      const updated = await Attachment.findOneAndUpdate({ _id: a._id, state: "processing" }, { $set: { state: rejection ? "rejected" : "clean", scan: result, ...(cleanKey ? { cleanKey } : {}), ...(rejection ? { error: rejection } : {}) }, ...(!rejection ? { $unset: { error: 1, processingKey: 1 } } : {}) }, { session });
      if (!updated) throw new Error("Evidence state changed.");
      const g = await Grievance.findById(a.grievance).session(session);
      if (g) {
        if (rejection) await Grievance.updateOne({ _id: g._id, attachmentCount: { $gt: 0 } }, { $inc: { attachmentCount: -1 } }, { session });
        await notify(g.student, `evidence:${a._id}`, rejection || "Evidence is ready for review.", { grievance: g._id, type: "evidence" }, session);
        await notifyAdmins(`evidence:${a._id}`, rejection || "New evidence is ready for review.", { grievance: g._id, type: "evidence" }, session);
      }
  });
  await deleteObject(a.key);
}
export async function fanOut(job: any, token: string) {
  const count = await transaction(async session => {
    await fenceJob(job, token, session);
    const a = await Announcement.findById(job.payload.announcement).session(session);
    if (!a || a.state !== "published") return 0;
    // Serialize archive/edit against delivery batches.
    await Announcement.updateOne({ _id: a._id, state: "published" }, { $inc: { __v: 1 } }, { session });
    const query = { ...announcementAudience(a), disabled: { $ne: true }, ...(job.payload.cursor ? { _id: { $gt: job.payload.cursor } } : {}) };
    const recipients = await User.find(query).sort({ _id: 1 }).limit(100).select("_id").session(session);
    for (const user of recipients) await notify(user._id, `announcement:${a._id}`, a.message, { announcement: a._id, type: "announcement", title: a.title }, session);
    await OutboxJob.updateOne({ _id: job._id, leaseToken: token }, { "payload.cursor": recipients.length ? String(recipients.at(-1)._id) : job.payload.cursor }, { session });
    return recipients.length;
  });
  if (count === 100) {
    await OutboxJob.updateOne({ _id: job._id, leaseToken: token }, { state: "pending", attempts: 0, availableAt: new Date(), $unset: { leaseUntil: 1, leaseToken: 1 } });
    return false;
  }
  return true;
}
export async function runOneJob() {
  const token = randomUUID(), now = new Date();
  const job = await OutboxJob.findOneAndUpdate({ $or: [{ state: "pending", availableAt: { $lte: now } }, { state: "running", leaseUntil: { $lt: now } }] }, { state: "running", leaseToken: token, leaseUntil: new Date(Date.now() + 300000), $inc: { attempts: 1 } }, { new: true, sort: { availableAt: 1 } });
  if (!job) return false;
  const heartbeat = setInterval(() => { OutboxJob.updateOne({ _id: job._id, leaseToken: token }, { leaseUntil: new Date(Date.now() + 300000) }).catch(() => {}); }, 30000);
  try {
    let skipped = false;
    if (job.kind === "email") {
      await fenceJob(job, token);
      const user = await User.findById(job.payload.user);
      const verificationValid = !job.payload.verification || !!(job.payload.verificationHash && await EmailVerificationToken.exists({ user: job.payload.user, hash: job.payload.verificationHash, expiresAt: { $gt: new Date() } }));
      if (user && !user.disabled && verificationValid && (job.payload.verification || (user.emailVerified && user.emailNotifications !== false))) await sendEmail(user.email, job.payload.subject, job.payload.message, job.key);
      else skipped = true;
    } else if (job.kind === "scan") await processScan(job, token);
    else if (job.kind === "announcement" && await fanOut(job, token) === false) return true;
    await OutboxJob.updateOne({ _id: job._id, leaseToken: token }, { state: skipped ? "skipped" : "done", $unset: { leaseToken: 1, leaseUntil: 1, lastError: 1 } });
  } catch (error: any) {
    if (error instanceof LeaseLostError) return true;
    const updated = await OutboxJob.updateOne({ _id: job._id, leaseToken: token }, { state: job.attempts >= 5 ? "failed" : "pending", availableAt: new Date(Date.now() + Math.min(3600000, 2000 * 2 ** job.attempts)), lastError: "Delivery or processing failed. Check integration configuration and service health.", $unset: { leaseToken: 1, leaseUntil: 1 } });
    if (updated?.matchedCount && job.kind === "scan" && job.attempts >= 5) await Attachment.updateOne({ _id: job.payload.attachment, state: "processing" }, { error: "Security checks are unavailable. An administrator can retry processing." });
  } finally { clearInterval(heartbeat); }
  return true;
}
