import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true }, title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 5000 },
  audience: { type: String, enum: ["campus", "students", "admins", "academic-department", "service-department"], required: true },
  department: String,
  state: { type: String, enum: ["draft", "published", "archived"], default: "draft" }, publishedAt: Date,
}, { timestamps: true });
schema.index({ state: 1, createdAt: -1 });
const Announcement: Model<InferSchemaType<typeof schema>> = models.Announcement || model<InferSchemaType<typeof schema>>("Announcement", schema);
export default Announcement;
