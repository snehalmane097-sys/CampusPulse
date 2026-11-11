export function canReleaseEvidence(a: { state: string; cleanKey?: string; scan?: string }, production = process.env.NODE_ENV === "production") {
  return a.state === "clean" && !!a.cleanKey && (!production || a.scan === "clean");
}
