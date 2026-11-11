import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { ApiError, authenticate, body, fail, id, limit, pagination, text, transaction } from "@/lib/api";
import { grievanceAccess } from "./access";
import { notify, notifyAdmins, emitInbox } from "./notifications";
import { transition, emitTransition } from "./lifecycle";
import { sanitizeGrievanceForAdmin } from "@/lib/sanitize";
import { MAX_FILES, MAX_TOTAL_BYTES, validateUpload } from "@/lib/uploadPolicy";
import { newKey, putObject, getObject, signedS3Url, s3UploadPolicy, storageMode } from "@/lib/storage";
import Attachment from "@/models/Attachment";
import Announcement from "@/models/Announcement";
import Notification from "@/models/Notification";
import User from "@/models/User";
import Grievance from "@/models/Grievance";
import ResolutionFeedback from "@/models/ResolutionFeedback";
import ReopenRequest from "@/models/ReopenRequest";
import OutboxJob from "@/models/OutboxJob";
import { deletionDeadline, evidenceDeletionQuery } from "./evidenceLifecycle";
import { canReleaseEvidence } from "@/lib/evidencePolicy";

export function announcementAudience(a: any) {
  if (a.audience === "students") return { role: "student" };
  if (a.audience === "admins") return { role: "admin" };
  if (a.audience === "academic-department") return { role: "student", academicDepartment: a.department };
  if (a.audience === "service-department") return { role: "admin", department: a.department };
  return {};
}
function attachmentDTO(a: any, anonymous: boolean) {
  return { _id: a._id, name: anonymous ? `Evidence ${String(a._id).slice(-6)}.${a.mime === "application/pdf" ? "pdf" : a.mime === "video/mp4" ? "mp4" : a.mime.split("/")[1]}` : a.name,
    mime: a.mime, size: a.size, state: a.state, scan: a.scan, review: a.review, reviewNote: a.reviewNote, createdAt: a.createdAt, error: a.error };
}
const safeFeedback = (f: any) => ({ _id: f._id, rating: f.rating, comment: f.comment, cycle: f.cycle, department: f.department, createdAt: f.createdAt });
const safeReopen = (r: any) => ({ _id: r._id, grievance: r.grievance, cycle: r.cycle, reason: r.reason, state: r.state, decisionReason: r.decisionReason, createdAt: r.createdAt, decidedAt: r.decidedAt });

export async function handleV2(req: NextRequest, operation: string, params: Record<string, string> = {}) {
  try {
    const adminOnly = ["review", "reopen-list", "reopen-decision", "satisfaction", "delivery"].includes(operation);
    const actor = await authenticate(req, adminOnly);
    if (req.method !== "GET") await limit(req, operation, operation === "attachments" ? 15 : 60, actor.userId);

    if (operation === "notifications") {
      const { limit: size, filter } = pagination(req);
      const notifications = await Notification.find({ user: actor.userId, ...filter, ...(req.nextUrl.searchParams.get("unread") === "true" ? { read: false } : {}) }).sort({ _id: -1 }).limit(size + 1).lean();
      const more = notifications.length > size; if (more) notifications.pop();
      return NextResponse.json({ notifications, nextCursor: more ? String(notifications.at(-1)!._id) : null });
    }
    if (operation === "unread") return NextResponse.json({ count: await Notification.countDocuments({ user: actor.userId, read: false }) });
    if (operation === "read" || operation === "read-all") {
      const query = { user: actor.userId, read: false, ...(operation === "read" ? { _id: id(params.id) } : {}) };
      await Notification.updateMany(query, { read: true, readAt: new Date() }); emitInbox(actor.userId);
      return NextResponse.json({ success: true });
    }
    if (operation === "preferences") {
      if (req.method === "PATCH") {
        const data = await body(req);
        if (typeof data.emailNotifications !== "boolean") throw new ApiError(400, "Email preference must be true or false.");
        // Academic department is provisioned by a trusted operator, never self-selected for targeting.
        await User.updateOne({ _id: actor.userId }, { emailNotifications: data.emailNotifications });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ emailNotifications: actor.user.emailNotifications !== false, emailVerified: !!actor.user.emailVerified, academicDepartment: actor.user.academicDepartment || "Unassigned", department: (actor.role === "admin" ? actor.user.department : actor.user.academicDepartment) || "Unassigned" });
    }
    if (operation === "announcements") {
      if (req.method === "GET") {
        const { limit: size, filter } = pagination(req);
        const audience = actor.role === "admin" ? {} : { state: "published", $or: [{ audience: "campus" }, { audience: "students" }, ...(actor.user.academicDepartment ? [{ audience: "academic-department", department: actor.user.academicDepartment }] : [])] };
        const announcements = await Announcement.find({ ...audience, ...filter }).sort({ _id: -1 }).limit(size + 1).lean();
        const more = announcements.length > size; if (more) announcements.pop();
        return NextResponse.json({ announcements, nextCursor: more ? String(announcements.at(-1)!._id) : null });
      }
      if (actor.role !== "admin") throw new ApiError(403, "Administrator access required.");
      const data = await body(req), title = text(data.title, "Title", 3, 160), message = text(data.message, "Announcement", 5, 5000);
      if (!["campus", "students", "admins", "academic-department", "service-department"].includes(data.audience)) throw new ApiError(400, "Select a valid audience.");
      const department = data.audience.endsWith("department") ? text(data.department, "Department", 2, 120) : undefined;
      const announcement = await Announcement.create({ title, message, audience: data.audience, department, author: actor.userId });
      return NextResponse.json({ announcement }, { status: 201 });
    }
    if (operation === "publish" || operation === "announcement") {
      if (actor.role !== "admin") throw new ApiError(403, "Administrator access required.");
      const editData = operation === "announcement" && req.method !== "DELETE" ? await body(req) : null;
      const announcement = await transaction(async session => {
        const a = await Announcement.findById(id(params.id)).session(session);
        if (!a) throw new ApiError(404, "Announcement not found.");
        if (operation === "publish") {
          if (a.state === "published") return a;
          if (a.state !== "draft") throw new ApiError(409, "Only drafts can be published.");
          a.state = "published"; a.publishedAt = new Date(); await a.save({ session });
          await OutboxJob.create([{ key: `announcement:${a._id}`, kind: "announcement", payload: { announcement: String(a._id) } }], { session });
        } else {
          if (req.method === "DELETE") { a.state = "archived"; await a.save({ session }); }
          else {
            if (a.state !== "draft") throw new ApiError(409, "Only drafts can be edited.");
            a.title = text(editData.title, "Title", 3, 160); a.message = text(editData.message, "Announcement", 5, 5000); await a.save({ session });
          }
        }
        return a;
      });
      emitInbox(); return NextResponse.json({ announcement });
    }
    if (operation === "delivery") {
      if (req.method === "POST") {
        const data = await body(req);
        const result = await OutboxJob.updateOne({ _id: id(text(data.id, "Job ID", 24, 24)), state: "failed" }, { state: "pending", attempts: 0, availableAt: new Date(), $unset: { leaseToken: 1, leaseUntil: 1, lastError: 1 } });
        if (!result.modifiedCount) throw new ApiError(409, "Job is not eligible for retry.");
      }
      const counts = await OutboxJob.aggregate([{ $group: { _id: { kind: "$kind", state: "$state" }, count: { $sum: 1 } } }]);
      const failures = await OutboxJob.find({ state: "failed" }).select("kind state attempts updatedAt lastError").sort({ updatedAt: -1 }).limit(25).lean();
      return NextResponse.json({ counts, failures });
    }
    if (operation === "attachments") {
      const g = await grievanceAccess(params.id, actor);
      if (req.method === "GET") {
        const attachments = await Attachment.find({ grievance: g._id, state: { $ne: "deleted" } }).sort({ createdAt: -1 }).limit(100);
        return NextResponse.json({ attachments: attachments.map(a => attachmentDTO(a, g.isAnonymous && actor.role === "admin")) });
      }
      const data = await body(req); validateUpload(data.mime, data.size, data.checksum);
      const attachment = await transaction(async session => {
        const files = await Attachment.find({ grievance: g._id, state: { $nin: ["deleted", "rejected"] } }).session(session);
        if (files.length >= MAX_FILES || files.reduce((sum, a) => sum + a.size, 0) + data.size > MAX_TOTAL_BYTES) throw new ApiError(413, "Grievance evidence quota reached (10 files / 200 MB).");
        // Serialize concurrent quota reservations on the grievance document.
        await Grievance.updateOne({ _id: g._id }, { $inc: { attachmentCount: 1 } }, { session });
        const [a] = await Attachment.create([{ grievance: g._id, uploader: actor.userId, name: text(data.name, "Filename", 1, 180).replace(/[\x00-\x1f\\/]/g, "_"), mime: data.mime, size: data.size, checksum: data.checksum.toLowerCase(), key: newKey("quarantine"), expiresAt: new Date(Date.now() + 3600000) }], { session });
        return a;
      });
      const policy = storageMode() === "s3" ? s3UploadPolicy(attachment.key, attachment.mime, attachment.size, attachment.checksum) : null;
      const uploadUrl = policy ? policy.url : `/api/attachments/${attachment._id}/upload`;
      return NextResponse.json({ attachment: attachmentDTO(attachment, g.isAnonymous && actor.role === "admin"), uploadUrl, uploadFields: policy?.fields, driver: storageMode() }, { status: 201 });
    }
    if (["upload", "complete", "access", "review", "attachment"].includes(operation)) {
      const attachment = await Attachment.findById(id(params.attachmentId));
      if (!attachment || attachment.state === "deleted") throw new ApiError(404, "Attachment not found.");
      const g = await grievanceAccess(String(attachment.grievance), actor);
      if (["upload", "complete"].includes(operation) && String(attachment.uploader) !== actor.userId) throw new ApiError(403, "Only the uploader can complete this upload.");
      if (operation === "upload") {
        if (storageMode() !== "local" || attachment.state !== "pending" || attachment.expiresAt < new Date()) throw new ApiError(409, "Upload is unavailable or expired.");
        const reader = req.body?.getReader(); if (!reader) throw new ApiError(400, "File is required.");
        const chunks: Buffer[] = []; let count = 0;
        for (;;) { const part = await reader.read(); if (part.done) break; count += part.value.length; if (count > attachment.size) { await reader.cancel(); throw new ApiError(413, "File is larger than declared."); } chunks.push(Buffer.from(part.value)); }
        if (count !== attachment.size) throw new ApiError(400, "File size does not match.");
        await putObject(attachment.key, Buffer.concat(chunks), attachment.mime);
        return NextResponse.json({ success: true });
      }
      if (operation === "complete") {
        await transaction(async session => {
          const a = await Attachment.findById(attachment._id).session(session);
          if (a.state === "processing" || a.state === "clean") return;
          if (a.state !== "pending" || a.expiresAt < new Date()) throw new ApiError(409, "Upload expired or rejected.");
          a.state = "processing"; await a.save({ session });
          await OutboxJob.updateOne({ key: `scan:${a._id}` }, { $setOnInsert: { kind: "scan", payload: { attachment: String(a._id) }, state: "pending", availableAt: new Date() } }, { upsert: true, session });
        });
        return NextResponse.json({ message: "Evidence queued for security checks." }, { status: 202 });
      }
      if (operation === "review") {
        const data = await body(req);
        if (!["accepted", "rejected"].includes(data.review) || attachment.state !== "clean") throw new ApiError(409, "Only available evidence can be reviewed.");
        const note = data.reviewNote ? text(data.reviewNote, "Review note", 1, 2000) : "";
        if (data.review === "rejected" && !note) throw new ApiError(400, "A rejection reason is required.");
        await transaction(async session => {
          const updated = await Attachment.updateOne({ _id: attachment._id, state: "clean" }, { review: data.review, reviewNote: note, reviewedBy: actor.userId, reviewedAt: new Date() }, { session });
          if (!updated.matchedCount) throw new ApiError(409, "Evidence changed. Refresh before reviewing.");
          await notify(g.student, `evidence-review:${attachment._id}:${randomUUID()}`, `Evidence review: ${data.review}.`, { grievance: g._id, type: "evidence" }, session);
        });
        emitInbox(String(g.student)); return NextResponse.json({ success: true });
      }
      if (operation === "attachment") {
        if (actor.role !== "admin" && String(attachment.uploader) !== actor.userId) throw new ApiError(403, "You cannot remove this attachment.");
        if (actor.role !== "admin" && attachment.review !== "pending") throw new ApiError(409, "Reviewed evidence is retained; contact an administrator.");
        await transaction(async session => {
          // Recheck review permission atomically: an admin may review between the initial read and this write.
          const updated = await Attachment.findOneAndUpdate(evidenceDeletionQuery(attachment, actor), { state: "deleted", expiresAt: deletionDeadline(attachment.expiresAt) }, { session });
          if (!updated) throw new ApiError(409, "Evidence changed or was reviewed. Refresh before removing it.");
          if (updated && updated.state !== "rejected") await Grievance.updateOne({ _id: g._id, attachmentCount: { $gt: 0 } }, { $inc: { attachmentCount: -1 } }, { session });
        });
        return NextResponse.json({ success: true });
      }
      if (!canReleaseEvidence(attachment)) throw new ApiError(409, "Evidence is not available until security checks finish with the configured production scanner.");
      if (attachment.review === "rejected" && actor.role !== "admin" && String(attachment.uploader) !== actor.userId) throw new ApiError(403, "Evidence access denied.");
      if (storageMode() === "s3") return NextResponse.redirect(signedS3Url("GET", attachment.cleanKey, 60), 307);
      const bytes = await getObject(attachment.cleanKey, attachment.size + 1024);
      const range = req.headers.get("range"); let start = 0, end = bytes.length - 1;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range); if (!match) throw new ApiError(416, "Unsupported byte range.");
        start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (start > end || start >= bytes.length) throw new ApiError(416, "Invalid byte range.");
      }
      return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), { status: range ? 206 : 200, headers: {
        "Content-Type": attachment.mime, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="evidence.${attachment.mime === "application/pdf" ? "pdf" : attachment.mime === "video/mp4" ? "mp4" : attachment.mime.split("/")[1]}"`,
        "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN", ...(range ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}),
      } });
    }
    if (["feedback", "reopen"].includes(operation)) {
      if (req.method === "POST" && actor.role !== "student") throw new ApiError(403, "Only students can submit resolution feedback or reopening requests.");
      const g = await grievanceAccess(params.id, actor, req.method === "POST");

      if (req.method === "GET") { const records = operation === "feedback" ? await ResolutionFeedback.find({ grievance: g._id }).sort({ createdAt: -1 }).limit(100) : await ReopenRequest.find({ grievance: g._id }).sort({ createdAt: -1 }).limit(100); return NextResponse.json({ records: records.map(r => operation === "feedback" ? safeFeedback(r) : safeReopen(r)) }); }
      const data = await body(req);
      const record = await transaction(async session => {
        const fresh = await grievanceAccess(params.id, actor, true, session);
        if (fresh.status !== "Resolved") throw new ApiError(409, "This grievance must be resolved first.");
        const cycle = fresh.resolutionCycle || 0;
        // Serialize against status transitions, feedback submissions and reopening decisions.
        await Grievance.updateOne({ _id: fresh._id }, { $inc: { __v: 1 } }, { session });
        if (operation === "feedback") {
          if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) throw new ApiError(400, "Rating must be an integer from 1 to 5.");
          const comment = data.comment ? text(data.comment, "Feedback", 1, 2000) : "";
          const [f] = await ResolutionFeedback.create([{ grievance: fresh._id, student: actor.userId, cycle, rating: data.rating, comment, department: fresh.resolutionDepartment || fresh.department, resolvedAt: fresh.resolvedAt }], { session });
          await notifyAdmins(`feedback:${f._id}`, "New resolution feedback is available.", { grievance: fresh._id, type: "feedback" }, session);
          return safeFeedback(f);
        }
        const reason = text(data.reason, "Reopening reason", 10, 2000);
        const [r] = await ReopenRequest.create([{ grievance: fresh._id, student: actor.userId, cycle, reason, department: fresh.resolutionDepartment || fresh.department }], { session });
        await notifyAdmins(`reopen:${r._id}`, "A grievance reopening request needs review.", { grievance: fresh._id, type: "reopen" }, session);
        return safeReopen(r);
      });
      emitInbox(); return NextResponse.json({ record }, { status: 201 });
    }
    if (operation === "reopen-list") {
      const { limit: size, filter } = pagination(req);
      const requests = await ReopenRequest.find({ ...filter, state: "pending" }).sort({ _id: -1 }).limit(size + 1);
      const more = requests.length > size; if (more) requests.pop();
      const records = [];
      for (const r of requests) { const g = await Grievance.findById(r.grievance); records.push({ ...safeReopen(r), grievanceDetail: g ? sanitizeGrievanceForAdmin(g) : null }); }
      return NextResponse.json({ requests: records, nextCursor: more ? String(requests.at(-1)!._id) : null });
    }
    if (operation === "reopen-decision") {
      const data = await body(req);
      if (!["approved", "rejected"].includes(data.state)) throw new ApiError(400, "Select approve or reject.");
      const reason = text(data.decisionReason, "Decision reason", 3, 2000);
      const request = await transaction(async session => {
        const r = await ReopenRequest.findById(id(params.id)).session(session);
        if (!r) throw new ApiError(404, "Request not found.");
        if (r.state !== "pending") throw new ApiError(409, "This request has already been decided.");
        const g = await grievanceAccess(String(r.grievance), actor, false, session);
        if (g.status !== "Resolved" || (g.resolutionCycle || 0) !== r.cycle) throw new ApiError(409, "This resolution is no longer current.");
        r.state = data.state; r.decisionReason = reason; r.decidedBy = new Types.ObjectId(actor.userId); r.decidedAt = new Date(); await r.save({ session });
        const changed = data.state === "approved" ? await transition(g, "In Progress", actor, session, true) : null;
        if (!changed) await Grievance.updateOne({ _id: g._id }, { $inc: { __v: 1 } }, { session });
        await notify(r.student, `reopen-decision:${r._id}`, `Your reopening request was ${data.state}. ${reason}`, { grievance: g._id, type: "reopen" }, session);
        return { record: safeReopen(r), changed };
      });
      if (request.changed) emitTransition(request.changed); emitInbox(); return NextResponse.json({ request: request.record });
    }
    if (operation === "satisfaction") {
      const now = new Date(), from = new Date(req.nextUrl.searchParams.get("from") || new Date(now.getTime() - 90 * 86400000).toISOString()), to = new Date(req.nextUrl.searchParams.get("to") || now.toISOString());
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) throw new ApiError(400, "Invalid date range.");
      const rows = await ResolutionFeedback.aggregate([
        { $match: { resolvedAt: { $gte: from, $lte: to } } },
        { $lookup: { from: "grievances", localField: "grievance", foreignField: "_id", as: "report" } }, { $unwind: "$report" },
        ...(req.nextUrl.searchParams.get("history") === "true" ? [] : [{ $match: { $expr: { $eq: ["$cycle", { $ifNull: ["$report.resolutionCycle", 0] }] } } }]),
        { $group: { _id: "$department", average: { $avg: "$rating" }, count: { $sum: 1 }, ratings: { $push: "$rating" } } }, { $sort: { _id: 1 } },
      ]);
      const resolutions = await Grievance.aggregate([{ $unwind: "$history" }, { $match: { "history.status": "Resolved", "history.at": { $gte: from, $lte: to } } }, ...(req.nextUrl.searchParams.get("history") === "true" ? [] : [{ $match: { $expr: { $eq: ["$history.cycle", "$resolutionCycle"] } } }]), { $group: { _id: "$history.department", total: { $sum: 1 } } }]);
      const reopens = await ReopenRequest.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: "$department", requested: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$state", "approved"] }, 1, 0] } } } }]);
      const departments = Array.from(new Set([...rows, ...resolutions, ...reopens].map(r => r._id))).map(name => {
        const r = rows.find(r => r._id === name), total = resolutions.find(r => r._id === name)?.total || 0, reopen = reopens.find(r => r._id === name);
        return { department: name, average: r ? Number(r.average.toFixed(2)) : null, rated: r?.count || 0, resolutions: total, responseRate: total ? Number(((r?.count || 0) / total * 100).toFixed(1)) : null, distribution: [1,2,3,4,5].map(rating => ({ rating, count: r?.ratings.filter((v: number) => v === rating).length || 0 })), reopeningRequests: reopen?.requested || 0, approved: reopen?.approved || 0 };
      });
      return NextResponse.json({ departments, from, to, legacyResolutionDatesExcluded: true });
    }
    throw new ApiError(404, "Endpoint not found.");
  } catch (error) { return fail(error); }
}
