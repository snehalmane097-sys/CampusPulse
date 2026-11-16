import { Schema, models, model, Model, InferSchemaType } from "mongoose";
const schema = new Schema({ _id: String, version: { type: Number, default: 0 } });
const ClusterLock: Model<InferSchemaType<typeof schema>> = models.ClusterLock || model<InferSchemaType<typeof schema>>("ClusterLock", schema);
export default ClusterLock;
