import mongoose, { Schema, models, model } from "mongoose";

export type GrievanceCategory =
  | "Network"
  | "Electrical"
  | "Plumbing"
  | "Facilities"
  | "Academic"
  | "Hostel"
  | "Other";

export type GrievanceStatus = "Pending" | "In Progress" | "Resolved";
export type GrievancePriority = "Low" | "Medium" | "High" | "Critical";

export interface IGrievance {
  _id: string;
  student?: mongoose.Types.ObjectId; // always set, even for anonymous reports — see isAnonymous
  isAnonymous: boolean; // controls what admins are shown, not what's stored
  rawText: string;
  submittedVia: "text" | "voice";

  category: GrievanceCategory;
  location: string;
  department: string;

  priorityLabel: GrievancePriority; // final system-computed label (student's own severity feeds the score but is not kept separately)
  priorityScore: number; // system-calculated 0-100
  priorityReasons: string[]; // plain-language "why this priority" for the admin dashboard
  affectedCount: number; // how many similar reports feed this one

  status: GrievanceStatus;
  incident?: mongoose.Types.ObjectId | null; // linked incident, if clustered

  createdAt: Date;
  updatedAt: Date;
}

const GrievanceSchema = new Schema<IGrievance>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User" },
    isAnonymous: { type: Boolean, default: false },
    rawText: { type: String, required: true },
    submittedVia: { type: String, enum: ["text", "voice"], default: "text" },

    category: {
      type: String,
      enum: ["Network", "Electrical", "Plumbing", "Facilities", "Academic", "Hostel", "Other"],
      default: "Other",
    },
    location: { type: String, default: "Unspecified" },
    department: { type: String, default: "General Administration" },

    priorityLabel: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
    priorityScore: { type: Number, default: 0 },
    // Optional/defaulted so existing documents created before this field
    // existed still load fine — no migration needed.
    priorityReasons: { type: [String], default: [] },
    affectedCount: { type: Number, default: 1 },

    status: { type: String, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" },
    incident: { type: Schema.Types.ObjectId, ref: "Incident", default: null },
  },
  { timestamps: true }
);

export default (models.Grievance as mongoose.Model<IGrievance>) || model<IGrievance>("Grievance", GrievanceSchema);
