import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({ user: { type: Schema.Types.ObjectId, ref: "User", required: true }, hash: { type: String, unique: true }, expiresAt: { type: Date, expires: 0 } });
const EmailVerificationToken: Model<InferSchemaType<typeof schema>> = models.EmailVerificationToken || model<InferSchemaType<typeof schema>>("EmailVerificationToken", schema);
export default EmailVerificationToken;
