export type CountRow = { count: number };
export function chartState(data: readonly CountRow[] | null | undefined, expectedTotal?: number): "ready" | "empty" | "invalid" | "mismatch" {
  if (!Array.isArray(data) || data.some(row => !row || typeof row.count !== "number" || !Number.isFinite(row.count) || row.count < 0)) return "invalid";
  if (expectedTotal !== undefined) {
    if (!Number.isFinite(expectedTotal) || expectedTotal < 0) return "invalid";
    if (chartTotal(data) !== expectedTotal) return "mismatch";
  }
  return data.some(row => row.count > 0) ? "ready" : "empty";
}
export function chartTotal(data: readonly CountRow[]) { return data.reduce((sum,row)=>sum+row.count,0); }
export function chartLabel(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() && !["null","undefined"].includes(value.trim()) ? value.trim() : fallback;
}
