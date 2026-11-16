import mongoose, { Schema, models, model } from "mongoose";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "student" | "admin";
  department?: string; // for admins: which department they handle
  academicDepartment?: string;
  emailVerified?: boolean;
  emailNotifications?: boolean;
  disabled?: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["student", "admin"], default: "student" },
  department: { type: String },
  academicDepartment: { type: String, maxlength: 120, index: true },
  emailVerified: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
