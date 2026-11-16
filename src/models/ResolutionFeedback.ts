import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true }, cycle: { type: Number, required: true },
  rating: { type: Number, min: 1, max: 5, required: true, validate: Number.isInteger },
  comment: { type: String, maxlength: 2000, default: "" }, department: { type: String, required: true },
  resolvedAt: Date,
}, { timestamps: true });
schema.index({ grievance: 1, cycle: 1 }, { unique: true });
schema.index({ department: 1, createdAt: -1 });
const ResolutionFeedback: Model<InferSchemaType<typeof schema>> = models.ResolutionFeedback || model<InferSchemaType<typeof schema>>("ResolutionFeedback", schema);
export default ResolutionFeedback;
