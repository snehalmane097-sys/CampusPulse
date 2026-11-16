import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance", required: true, index: true },
  uploader: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, maxlength: 180 }, mime: String, size: Number, checksum: String,
  key: { type: String, required: true }, cleanKey: String, processingKey: String,
  state: { type: String, enum: ["pending", "processing", "clean", "rejected", "deleted"], default: "pending" },
  scan: { type: String, enum: ["pending", "clean", "infected", "development-unscanned"], default: "pending" },
  review: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  reviewNote: { type: String, maxlength: 2000 }, reviewedBy: { type: Schema.Types.ObjectId, ref: "User" }, reviewedAt: Date,
  error: String, expiresAt: Date,
}, { timestamps: true });
schema.index({ state: 1, expiresAt: 1 });
const Attachment: Model<InferSchemaType<typeof schema>> = models.Attachment || model<InferSchemaType<typeof schema>>("Attachment", schema);
export default Attachment;
