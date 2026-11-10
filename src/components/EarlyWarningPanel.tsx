import { EarlyWarningDTO } from "@/types";
import { IconAlertTriangle, IconCheckCircle } from "./Icons";

const SEVERITY_DOT: Record<EarlyWarningDTO["severity"], string> = {
  High: "bg-critical animate-glowPulse",
  Medium: "bg-amber",
};

const SEVERITY_TEXT: Record<EarlyWarningDTO["severity"], string> = {
  High: "text-critical",
  Medium: "text-amber",
};

export default function EarlyWarningPanel({ warnings }: { warnings: EarlyWarningDTO[] }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 text-amber" /> Early Warnings
        </h3>
        <span className="text-[11px] font-mono text-slate-soft border border-white/10 rounded-full px-2 py-0.5">
          rule-based, not ML
        </span>
      </div>

      {warnings.length === 0 ? (
        <p className="text-sm text-slate-soft flex items-center gap-2">
          <IconCheckCircle className="w-4 h-4 text-signal" /> No emerging campus issues detected.
        </p>
      ) : (
        <div className="space-y-2.5">
          {warnings.map((w, i) => (
            <div
              key={w.id}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-rise flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3"
            >
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[w.severity]}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {w.type} — {w.location}
                </p>
                <p className="text-xs text-slate-soft mt-0.5">{w.reason}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                  <span className="text-slate-soft">
                    {w.reportCount} report{w.reportCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-soft">{w.affectedStudents} affected</span>
                  <span className={`font-medium ${SEVERITY_TEXT[w.severity]}`}>{w.severity} severity</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
