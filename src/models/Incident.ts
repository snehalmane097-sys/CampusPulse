import mongoose, { Schema, models, model } from "mongoose";

export interface IIncident {
  _id: string;
  title: string; // e.g. "Block C Network Failure"
  category: string;
  location: string;
  department: string;
  status: "Pending" | "In Progress" | "Resolved";
  severityScore: number;
  grievanceCount: number;
  grievances: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    department: { type: String, required: true },
    status: { type: String, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" },
    severityScore: { type: Number, default: 0 },
    grievanceCount: { type: Number, default: 1 },
    grievances: [{ type: Schema.Types.ObjectId, ref: "Grievance" }],
  },
  { timestamps: true }
);

export default (models.Incident as mongoose.Model<IIncident>) || model<IIncident>("Incident", IncidentSchema);
