"use client";

import { IncidentDetailDTO } from "@/types";
import { StatusBadge, PriorityBadge } from "./Badges";
import { IconClock, IconMapPin, IconUsers } from "./Icons";
import GrievanceDetailPanel from "./GrievanceDetailPanel";
import { useState, useEffect } from "react";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diffMs / 36e5);
  if (hrs < 1) return "less than an hour ago";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: IncidentDetailDTO | null;
  onClose: () => void;
}) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  useEffect(() => { setSelectedReport(null); }, [incident?._id]);
  if (!incident) return null;

  // Union of every linked report's reasons, in first-seen order — the
  // incident-level "why this priority" the brief asks for, built from data
  // that already exists rather than a second scoring pass.
  const aggregatedReasons = Array.from(new Set(incident.reports.flatMap((r) => r.priorityReasons || [])));

  return (
    <div
      className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-slate-soft">INC-{incident._id.slice(-6).toUpperCase()}</p>
            <h2 className="font-display text-xl font-semibold mt-0.5">{incident.title}</h2>
            <p className="text-sm text-slate-soft mt-1 flex items-center gap-1.5">
              <IconMapPin className="w-3.5 h-3.5" /> {incident.location} · {incident.department}
            </p>
          </div>
          <StatusBadge status={incident.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="text-lg font-display font-semibold">{incident.grievanceCount}</p>
            <p className="text-[11px] text-slate-soft mt-0.5 flex items-center justify-center gap-1">
              <IconUsers className="w-3 h-3" /> reports
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="text-lg font-display font-semibold">{incident.severityScore}</p>
            <p className="text-[11px] text-slate-soft mt-0.5">severity /100</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="text-lg font-display font-semibold">{timeAgo(incident.createdAt)}</p>
            <p className="text-[11px] text-slate-soft mt-0.5 flex items-center justify-center gap-1">
              <IconClock className="w-3 h-3" /> opened
            </p>
          </div>
        </div>

        {aggregatedReasons.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            <p className="text-xs uppercase tracking-wide text-slate-soft mb-2">Why this priority</p>
            <ul className="space-y-1 text-sm text-ivory/90">
              {aggregatedReasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-soft">
            Individual reports ({incident.reports.length})
          </p>
          {incident.reports.map((r, i) => (
            <div key={r._id} className="border border-white/10 rounded-lg p-3 bg-white/[0.02]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm min-w-0 break-words">
                  {r.isAnonymous ? (
                    <span className="text-slate-soft italic">Anonymous report #{i + 1}: </span>
                  ) : (
                    <span className="text-slate-soft">Report #{i + 1}: </span>
                  )}
                  {r.rawText}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button className="cp-secondary" onClick={() => setSelectedReport(r._id)}>Evidence & details</button>
                <PriorityBadge priority={r.priorityLabel} score={r.priorityScore} />
                <span className="text-[11px] text-slate-soft">{timeAgo(r.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
        {selectedReport && <GrievanceDetailPanel id={selectedReport} admin onClose={() => setSelectedReport(null)}/>}

        <button
          onClick={onClose}
          className="mt-5 w-full border border-white/10 rounded-lg py-2 text-sm text-slate-soft hover:text-ivory hover:border-white/30 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
