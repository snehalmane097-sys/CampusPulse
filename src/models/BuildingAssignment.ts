import mongoose, { Schema, models, model } from "mongoose";
interface Assignment {
  grievance: mongoose.Types.ObjectId; previousBuilding?: mongoose.Types.ObjectId; building?: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId; reason: string; revision: number; at: Date;
  previousDepartment?: string; department?: string;
}
const schema = new Schema<Assignment>({
  grievance: { type: Schema.Types.ObjectId, ref: "Grievance", required: true },
  previousBuilding: { type: Schema.Types.ObjectId, ref: "CampusBuilding" },
  building: { type: Schema.Types.ObjectId, ref: "CampusBuilding" },
  actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  previousDepartment: String, department: String,
  revision: { type: Number, required: true }, at: { type: Date, default: Date.now },
});
schema.index({ grievance: 1, revision: 1 }, { unique: true });
// Internal audit only; never populate this record into student/map responses.
export default (models.BuildingAssignment as mongoose.Model<Assignment>) || model<Assignment>("BuildingAssignment", schema);
