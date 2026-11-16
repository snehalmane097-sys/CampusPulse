import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({ key: { type: String, unique: true }, count: Number, expiresAt: { type: Date, expires: 0 } });
const RateLimit: Model<InferSchemaType<typeof schema>> = models.RateLimit || model<InferSchemaType<typeof schema>>("RateLimit", schema);
export default RateLimit;
