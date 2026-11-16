import mongoose, { Schema, models, model } from "mongoose";
import { BUILDING_CATEGORIES, CampusBuilding } from "@/lib/buildings";

type BuildingRecord = Omit<CampusBuilding, "_id"> & { nameKey: string };
const schema = new Schema<BuildingRecord>({
  featureId: { type: String, required: true, immutable: true },
  displayName: { type: String, required: true, maxlength: 120 },
  nameKey: { type: String, required: true },
  code: { type: String, default: "", maxlength: 30 },
  description: { type: String, default: "", maxlength: 1200 },
  category: { type: String, enum: BUILDING_CATEGORIES, default: "Other" },
  approved: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ featureId: 1 }, { unique: true });
schema.index({ nameKey: 1 }, { unique: true });
schema.index({ approved: 1, displayName: 1 });
export default (models.CampusBuilding as mongoose.Model<BuildingRecord>) || model<BuildingRecord>("CampusBuilding", schema);
