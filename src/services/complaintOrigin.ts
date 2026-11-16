import CampusBuilding from "@/models/CampusBuilding";
export async function withVerifiedOrigins(records: any[]) {
  const ids = records.map(g => g.building).filter(Boolean);
  const buildings = ids.length ? await CampusBuilding.find({ _id: { $in: ids }, approved: true }).select("_id displayName").lean() : [];
  return records.map(record => {
    const g = record.toObject ? record.toObject() : { ...record };
    const building = buildings.find(b => String(b._id) === String(g.building));
    return { ...g, origin: { department: g.originDepartment?.trim() || null, building: building ? { _id: String(building._id), displayName: building.displayName } : null } };
  });
}
