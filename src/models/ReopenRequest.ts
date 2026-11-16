import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true }, cycle: { type: Number, required: true },
  reason: { type: String, required: true, maxlength: 2000 },
  department: String,
  state: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  decisionReason: { type: String, maxlength: 2000 }, decidedBy: { type: Schema.Types.ObjectId, ref: "User" }, decidedAt: Date,
}, { timestamps: true });
schema.index({ grievance: 1, cycle: 1 }, { unique: true, partialFilterExpression: { state: "pending" } });
schema.index({ state: 1, createdAt: -1 });
const ReopenRequest: Model<InferSchemaType<typeof schema>> = models.ReopenRequest || model<InferSchemaType<typeof schema>>("ReopenRequest", schema);
export default ReopenRequest;
