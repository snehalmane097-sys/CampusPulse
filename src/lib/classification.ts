import { GrievanceCategory } from "@/models/Grievance";

// Keyword banks per category. Transparent, explainable rules — the PDF
// explicitly asks for this over a black-box ML model for the CNT demo.
const CATEGORY_KEYWORDS: Record<GrievanceCategory, string[]> = {
  Network: ["wifi", "wi-fi", "internet", "network", "connect", "connection", "lan", "ethernet", "router", "signal"],
  Electrical: ["power", "electric", "light", "fan", "socket", "wiring", "voltage", "switchboard", "short circuit"],
  Plumbing: ["water", "tap", "leak", "pipe", "toilet", "washroom", "drain", "flush"],
  Facilities: ["chair", "desk", "projector", "ac", "air condition", "classroom", "lab equipment", "furniture", "cleanliness"],
  Academic: ["exam", "marks", "grade", "attendance", "faculty", "lecture", "syllabus", "result"],
  Hostel: ["hostel", "mess", "room", "warden", "food", "canteen"],
  Other: [],
};

const CATEGORY_DEPARTMENT: Record<GrievanceCategory, string> = {
  Network: "IT / Network",
  Electrical: "Electrical Maintenance",
  Plumbing: "Civil / Plumbing",
  Facilities: "General Facilities",
  Academic: "Academic Office",
  Hostel: "Hostel Administration",
  Other: "General Administration",
};

// Locations recognised on campus. In a production system this would come
// from a campus map/location table; kept as a flat list for the demo.
const KNOWN_LOCATIONS = [
  "Block A", "Block B", "Block C", "Block D",
  "Lab 1", "Lab 2", "Lab 3", "Lab 4",
  "Library", "Auditorium", "Cafeteria", "Canteen",
  "Hostel A", "Hostel B", "Main Building", "Admin Block",
];

function normalize(text: string) {
  return text.toLowerCase();
}

export function detectCategory(text: string): GrievanceCategory {
  const t = normalize(text);
  let best: GrievanceCategory = "Other";
  let bestHits = 0;

  (Object.keys(CATEGORY_KEYWORDS) as GrievanceCategory[]).forEach((category) => {
    const hits = CATEGORY_KEYWORDS[category].filter((kw) => t.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = category;
    }
  });

  return best;
}

export function detectLocation(text: string): string {
  const t = normalize(text);
  const found = KNOWN_LOCATIONS.find((loc) => t.includes(loc.toLowerCase()));
  return found || "Unspecified";
}

export function departmentFor(category: GrievanceCategory): string {
  return CATEGORY_DEPARTMENT[category];
}

export interface ClassificationResult {
  category: GrievanceCategory;
  location: string;
  department: string;
}

export function classifyGrievance(text: string): ClassificationResult {
  const category = detectCategory(text);
  const location = detectLocation(text);
  return { category, location, department: departmentFor(category) };
}
