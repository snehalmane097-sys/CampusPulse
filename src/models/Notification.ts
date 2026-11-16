import mongoose, { Schema, models, model } from "mongoose";

export interface INotification {
  _id: string;
  user: mongoose.Types.ObjectId;
  grievance?: mongoose.Types.ObjectId;
  announcement?: mongoose.Types.ObjectId;
  type?: string;
  title?: string;
  readAt?: Date;
  eventKey?: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance" },
  announcement: { type: Schema.Types.ObjectId, ref: "Announcement" },
  type: { type: String, default: "status" }, title: String,
  eventKey: String, readAt: Date,
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
NotificationSchema.index({ user: 1, _id: -1 });
NotificationSchema.index({ user: 1, read: 1 });
NotificationSchema.index({ user: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } });

export default (models.Notification as mongoose.Model<INotification>) || model<INotification>("Notification", NotificationSchema);
