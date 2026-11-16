import User from "@/models/User";
export async function backfillMissingUserFields() {
  for (const [field, value] of Object.entries({ emailVerified: false, emailNotifications: true, disabled: false })) await User.updateMany({ [field]: { $exists: false } }, { $set: { [field]: value } });
}
