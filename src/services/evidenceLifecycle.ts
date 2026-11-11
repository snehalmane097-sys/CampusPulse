import Attachment from "@/models/Attachment";
import Grievance from "@/models/Grievance";
import { transaction } from "@/lib/api";
import { deleteObject } from "@/lib/storage";

// Cover outstanding five-minute upload grants and bounded in-flight storage writes.
export function deletionDeadline(original?: Date, now = Date.now()) { return new Date(Math.max(now + 10 * 60000, original?.getTime() || 0)); }
export function evidenceDeletionQuery(a: any, actor: any) { return { _id: a._id, state: { $ne: "deleted" }, ...(actor.role !== "admin" ? { uploader: actor.userId, review: "pending" } : {}) }; }
export async function cleanupEvidence() {
  const cutoff = new Date();
  const expired = await Attachment.find({ state: { $in: ["pending", "deleted", "clean", "rejected"] }, expiresAt: { $lte: cutoff } }).limit(50);
  for (const a of expired) {
    if (a.state === "pending") {
      // Claim expiration BEFORE deleting bytes. A completion that wins the race is preserved.
      await transaction(async session => {
        const claimed = await Attachment.findOneAndUpdate({ _id: a._id, state: "pending", expiresAt: { $lte: cutoff } }, { state: "deleted", expiresAt: deletionDeadline(a.expiresAt) }, { session });
        if (claimed) await Grievance.updateOne({ _id: a.grievance, attachmentCount: { $gt: 0 } }, { $inc: { attachmentCount: -1 } }, { session });
      });
      continue;
    }
    // Tombstones keep keys until all storage deletes succeed; failed cleanup can be retried.
    await deleteObject(a.key);
    if (a.processingKey && a.processingKey !== a.cleanKey) await deleteObject(a.processingKey);
    if (a.cleanKey && a.state === "deleted") await deleteObject(a.cleanKey);
    await Attachment.updateOne({ _id: a._id, state: a.state, expiresAt: a.expiresAt }, { $unset: { expiresAt: 1, processingKey: 1 } });
  }
}
