export function evidenceScanLabel(a: { scan?: string; state: string }) {
  if (a.scan === "development-unscanned") return "Not scanned — development mode";
  if (a.scan === "infected") return "Threat detected — access blocked";
  if (a.scan === "clean") return "Malware scan passed";
  return a.state === "rejected" ? "Security checks failed" : "Security checks pending";
}
export function evidenceReviewLabel(review: string) {
  return review === "accepted" ? "Accepted" : review === "rejected" ? "Rejected" : "Pending review";
}
