import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({ user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, expiresAt: { type: Date, required: true, expires: 0 } }, { timestamps: true });
const Session: Model<InferSchemaType<typeof schema>> = models.Session || model<InferSchemaType<typeof schema>>("Session", schema);
export default Session;
