import mongoose, { Schema, models, model } from "mongoose";

export interface INotification {
  _id: string;
  user: mongoose.Types.ObjectId;
  grievance: mongoose.Types.ObjectId;
  message: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance", required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.Notification as mongoose.Model<INotification>) || model<INotification>("Notification", NotificationSchema);
