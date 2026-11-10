import { IGrievance } from "@/models/Grievance";
import { EarlyWarningDTO } from "@/types";

// Explainable thresholds, not a trained model — deliberate per the CNT
// brief's "transparent statistics/rules, not black-box ML" requirement.
const WARNING_WINDOW_HOURS = 12;
const MIN_REPORTS_FOR_WARNING = 3;
const HIGH_SEVERITY_REPORT_THRESHOLD = 5;

// Groups recent, still-open grievances by category + location and flags any
// group whose report count within the window crosses the threshold. Pure
// function over data already loaded elsewhere (the analytics route) so it
// runs no extra database queries of its own.
export function computeEarlyWarnings(allGrievances: IGrievance[]): EarlyWarningDTO[] {
  const cutoff = Date.now() - WARNING_WINDOW_HOURS * 60 * 60 * 1000;

  const recentActive = allGrievances.filter(
    (g) => g.status !== "Resolved" && g.createdAt.getTime() >= cutoff && g.location !== "Unspecified"
  );

  const groups = new Map<string, IGrievance[]>();
  recentActive.forEach((g) => {
    const key = `${g.category}::${g.location}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  });

  const warnings: EarlyWarningDTO[] = [];

  groups.forEach((group, key) => {
    if (group.length < MIN_REPORTS_FOR_WARNING) return;

    const [category, location] = key.split("::");
    // Count distinct students where identity is known; anonymous reports
    // each still count as one affected person even without a linked identity.
    const knownStudents = new Set(
      group.filter((g) => g.student && !g.isAnonymous).map((g) => String(g.student))
    );
    const affectedStudents = knownStudents.size + group.filter((g) => g.isAnonymous).length;

    const severity: EarlyWarningDTO["severity"] =
      group.length >= HIGH_SEVERITY_REPORT_THRESHOLD ? "High" : "Medium";

    warnings.push({
      id: key,
      type: `${category} Spike`,
      category,
      location,
      reportCount: group.length,
      affectedStudents: Math.max(affectedStudents, group.length),
      severity,
      reason: `${group.length} similar ${category.toLowerCase()} complaints detected in ${location} within the last ${WARNING_WINDOW_HOURS} hours.`,
      windowHours: WARNING_WINDOW_HOURS,
    });
  });

  return warnings.sort((a, b) => b.reportCount - a.reportCount);
}
