import { GrievanceCategory, GrievancePriority } from "@/models/Grievance";

// Category importance weights (0-25): network/electrical outages affect
// many people at once and are weighted higher than e.g. furniture requests.
const CATEGORY_WEIGHT: Record<GrievanceCategory, number> = {
  Network: 22,
  Electrical: 20,
  Plumbing: 14,
  Facilities: 8,
  Academic: 10,
  Hostel: 12,
  Other: 5,
};

export interface PriorityInput {
  category: GrievanceCategory;
  studentSeverity: GrievancePriority; // student's own Low/Medium/High/Critical pick
  affectedCount: number; // number of clustered/duplicate reports
  hoursUnresolved: number;
}

const SEVERITY_WEIGHT: Record<GrievancePriority, number> = {
  Low: 5,
  Medium: 12,
  High: 20,
  Critical: 28,
};

// Produces a 0-100 score. This is the "Smart Priority System" from the PDF:
// administrators see one number instead of trusting only a self-reported
// Low/Medium/High tag.
export function calculatePriorityScore({
  category,
  studentSeverity,
  affectedCount,
  hoursUnresolved,
}: PriorityInput): number {
  const categoryPoints = CATEGORY_WEIGHT[category];
  const severityPoints = SEVERITY_WEIGHT[studentSeverity];

  // Diminishing returns on affected count so 50 duplicates doesn't blow past 100.
  const impactPoints = Math.min(25, Math.round(Math.log2(affectedCount + 1) * 9));

  // Ages in slowly: capped so an old Low-priority ticket doesn't outrank a
  // fresh Critical one, but genuinely stale tickets still get pushed up.
  const agePoints = Math.min(25, Math.round(hoursUnresolved / 4));

  return Math.min(100, categoryPoints + severityPoints + impactPoints + agePoints);
}

export function scoreToLabel(score: number): GrievancePriority {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

// Turns the same inputs calculatePriorityScore already uses into plain-
// language reasons, so the admin (and a viva examiner) can see *why* a
// grievance landed at a given priority without reading the scoring code.
// Read-only: never used to change the score itself.
export function explainPriority(input: PriorityInput): string[] {
  const reasons: string[] = [];

  if (input.studentSeverity === "High" || input.studentSeverity === "Critical") {
    reasons.push(`High student-reported severity (${input.studentSeverity})`);
  }

  if (input.affectedCount > 1) {
    reasons.push(
      `${input.affectedCount} affected student${input.affectedCount === 1 ? "" : "s"} across similar reports`
    );
  }

  if (input.affectedCount >= 3) {
    reasons.push("Multiple similar complaints clustered into one incident");
  }

  if (input.category === "Network" || input.category === "Electrical") {
    reasons.push(`${input.category} issues affect many people at once`);
  }

  if (input.hoursUnresolved >= 12) {
    reasons.push(`Unresolved for ${Math.round(input.hoursUnresolved)}+ hours`);
  }

  if (reasons.length === 0) {
    reasons.push("Standard priority — no escalating factors detected yet");
  }

  return reasons;
}
