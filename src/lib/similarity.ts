// Lightweight, dependency-free similarity scoring so "WiFi not working in
// Block C", "Internet connection is down in C block", and "Can't connect to
// campus WiFi near Block C" are recognised as the same underlying report,
// per the PDF's duplicate-detection requirement.

const STOPWORDS = new Set([
  "the", "a", "an", "is", "in", "on", "at", "to", "of", "and", "or", "has",
  "have", "since", "morning", "near", "campus", "i", "my", "it", "this",
  "not", "no", "can't", "cant", "there", "are", "was", "were", "been",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok))
  );
}

// Jaccard similarity: overlap of meaningful words divided by union size.
// Simple, explainable, and good enough to cluster short grievance text.
export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((tok) => {
    if (setB.has(tok)) intersection += 1;
  });

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// Two grievances are considered "the same underlying incident" when they
// share category + location AND their text overlaps above this threshold.
export const SIMILARITY_THRESHOLD = 0.28;

export function isLikelyDuplicate(
  a: { category: string; location: string; rawText: string },
  b: { category: string; location: string; rawText: string }
): boolean {
  if (a.category !== b.category) return false;
  if (a.location === "Unspecified" || b.location === "Unspecified") return false;
  if (a.location !== b.location) return false;
  return jaccardSimilarity(a.rawText, b.rawText) >= SIMILARITY_THRESHOLD;
}
