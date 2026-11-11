export type GrievanceStatus = "Pending" | "In Progress" | "Resolved";
export type GrievancePriority = "Low" | "Medium" | "High" | "Critical";

export interface GrievanceDTO {
  _id: string;
  rawText: string;
  category: string;
  location: string;
  department: string;
  priorityLabel: GrievancePriority;
  priorityScore: number;
  priorityReasons?: string[];
  affectedCount: number;
  status: GrievanceStatus;
  isAnonymous: boolean;
  incident?: string | null;
  createdAt: string;
  resolutionCycle?: number;
  resolvedAt?: string;
  attachmentCount?: number;
  mapLocation?: import("@/lib/campusMap").MapLocation;
}

export interface IncidentDTO {
  _id: string;
  title: string;
  category: string;
  location: string;
  department: string;
  status: GrievanceStatus;
  severityScore: number;
  grievanceCount: number;
  createdAt: string;
}

// Returned by GET /api/incidents/[id] — the clustered view described in
// "improve incident clustering display": one incident, many linked reports.
export interface IncidentDetailDTO extends IncidentDTO {
  updatedAt: string;
  reports: {
    _id: string;
    rawText: string;
    status: GrievanceStatus;
    priorityLabel: GrievancePriority;
    priorityScore: number;
    priorityReasons: string[];
    isAnonymous: boolean;
    createdAt: string;
  }[];
}

export interface EarlyWarningDTO {
  id: string; // stable key: category + location, for React lists
  type: string; // e.g. "Network Spike"
  category: string;
  location: string;
  reportCount: number;
  affectedStudents: number;
  severity: "Medium" | "High";
  reason: string;
  windowHours: number;
}

export interface AnalyticsDTO {
  criticalActive?: number;
  total: number;
  active: number;
  resolved: number;
  avgResolutionHours: number;
  categoryDistribution: { category: string; count: number }[];
  priorityDistribution: { priority: string; count: number }[];
  hotspots: {
    location: string;
    count: number;
    lat: number | null;
    lng: number | null;
    activeIncidents: number;
    highestPriority: GrievancePriority | null;
  }[];
  trend: { date: string; count: number }[];
  earlyWarnings: EarlyWarningDTO[];
}
