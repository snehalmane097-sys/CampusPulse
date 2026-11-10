"use client";

import { useState } from "react";
import VoiceInput from "./VoiceInput";

import { GrievanceDTO } from "@/types";
import { PriorityBadge } from "./Badges";

interface Props {
  token: string;
  onSubmitted: () => void;
}

export default function GrievanceForm({ token, onSubmitted }: Props) {
  const [text, setText] = useState("");
  const [priorityLabel, setPriorityLabel] = useState("Medium");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittedVia, setSubmittedVia] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<GrievanceDTO | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) {
      setError("Please describe the issue in a bit more detail.");
      return;
    }
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rawText: text, priorityLabel, isAnonymous, submittedVia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setSuccess(data.grievance);
      setText("");
      onSubmitted();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} id="report-form" className="glass-card p-6 space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Report an issue</h2>
        <VoiceInput
          onResult={(spoken) => {
            setText((t) => (t ? `${t} ${spoken}` : spoken));
            setSubmittedVia("voice");
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSubmittedVia("text");
        }}
        rows={4}
        placeholder="e.g. The internet has stopped working in Lab 3 since morning"
        className="cp-input resize-none"
      />

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs text-slate-soft mb-1.5">Your sense of severity</label>
          <div className="flex gap-1.5">
            {(["Low", "Medium", "High", "Critical"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriorityLabel(p)}
                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                  priorityLabel === p
                    ? "border-signal text-signal bg-signal/10"
                    : "border-ink-line text-slate-soft hover:border-slate-soft"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-soft cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="accent-signal w-4 h-4"
          />
          Submit anonymously
        </label>
      </div>

      {error && (
        <p className="text-critical text-sm bg-critical/10 border border-critical/30 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <div className="text-sm bg-signal/10 border border-signal/30 rounded-lg px-3.5 py-3 animate-rise space-y-1.5">
          <p className="text-signal font-medium">Grievance submitted successfully.</p>
          <p className="text-slate-soft">
            Detected as <span className="text-ivory">{success.category}</span> ·{" "}
            <span className="text-ivory">{success.location}</span> → routed to{" "}
            <span className="text-ivory">{success.department}</span>
          </p>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={success.priorityLabel} score={success.priorityScore} />
            <span className="text-xs text-slate-soft">Status: {success.status}</span>
          </div>
          {success.incident && success.affectedCount > 1 && (
            <p className="text-amber text-xs">
              Your complaint has been linked to an existing campus incident — {success.affectedCount}{" "}
              reports now point to the same underlying issue.
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-signal text-ink font-semibold rounded-lg px-6 py-2.5 hover:bg-signal-dim transition-colors disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit grievance"}
      </button>
    </form>
  );
}
