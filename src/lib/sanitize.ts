// The `student` ref on a Grievance always stays in the database, even for
// anonymous submissions — that's what lets the owning student keep seeing
// and tracking their own report. This helper is the single place that
// strips it back out before an admin-facing response goes over the wire, so
// "anonymous" is enforced at the API boundary rather than at write time.
export function sanitizeGrievanceForAdmin<T extends { isAnonymous?: boolean; student?: unknown }>(
  grievance: T
): T {
  const plain = (grievance as any).toObject ? (grievance as any).toObject() : { ...grievance };
  if (plain.isAnonymous) {
    delete plain.student;
  }
  return plain;
}

export function sanitizeGrievanceListForAdmin<T extends { isAnonymous?: boolean; student?: unknown }>(
  grievances: T[]
): T[] {
  return grievances.map(sanitizeGrievanceForAdmin);
}
