import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({
  key: { type: String, unique: true, required: true }, kind: { type: String, enum: ["email", "scan", "announcement"], required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  state: { type: String, enum: ["pending", "running", "done", "failed", "skipped"], default: "pending" },
  attempts: { type: Number, default: 0 }, availableAt: { type: Date, default: Date.now }, leaseUntil: Date, leaseToken: String,
  lastError: String,
}, { timestamps: true });
schema.index({ state: 1, availableAt: 1, leaseUntil: 1 });
const OutboxJob: Model<InferSchemaType<typeof schema>> = models.OutboxJob || model<InferSchemaType<typeof schema>>("OutboxJob", schema);
export default OutboxJob;
