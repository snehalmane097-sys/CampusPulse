import type { GrievanceDTO } from "@/types";
export function complaintTitle(rawText: string) {
  const text = rawText.trim().split(/\r?\n/)[0].replace(/\s+/g, " ");
  return text.length > 110 ? text.slice(0, 107) + "…" : text || "Complaint";
}
export function originLabels(g: Pick<GrievanceDTO, "origin">) {
  return { department: g.origin?.department || "Not verified", building: g.origin?.building?.displayName || "Not verified" };
}
