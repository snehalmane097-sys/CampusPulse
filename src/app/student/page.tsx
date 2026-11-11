"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import GrievanceForm from "@/components/GrievanceForm";
import GrievanceCard from "@/components/GrievanceCard";
import ToastStack from "@/components/ToastStack";
import { SkeletonFeed } from "@/components/Skeletons";
import { GrievanceDTO } from "@/types";
import { getSocket } from "@/lib/socketClient";
import { useToastQueue } from "@/lib/useToastQueue";
import GrievanceDetailPanel from "@/components/GrievanceDetailPanel";
import CampusHub from "@/components/CampusHub";
import { api } from "@/lib/client";
import { readFeedWindow } from "@/lib/feedWindow";

export default function StudentDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [grievances, setGrievances] = useState<GrievanceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrievance, setSelectedGrievance] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null), [activeTotal, setActiveTotal] = useState(0);
  const pages = useRef(1), feedVersion = useRef(0);
  const invalidateFeed = useCallback(() => { ++feedVersion.current; }, []);
  const { toasts, push, dismiss } = useToastQueue();

  const loadGrievances = useCallback(async (_authToken: string) => {
    const version = ++feedVersion.current;
    try {
      const data = await readFeedWindow(api, "/api/grievances", "grievances", pages.current);
      if (version !== feedVersion.current) return;
      setGrievances(data.grievances); setCursor(data.nextCursor); setActiveTotal(data.summary.active); setLoadError("");
    } catch(e: any) { if (version === feedVersion.current) setLoadError(e.message); }
    finally { if (version === feedVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false; let cleanup = () => {};
    (async () => {
      try {
        const { user: currentUser } = await api("/api/auth/me");
        if (cancelled) return;
        if (currentUser.role !== "student") { router.replace("/admin"); return; }
        const t = "cookie-session"; setToken(t); setUser(currentUser); loadGrievances(t);
        const socket = getSocket();
        const reconnect = () => loadGrievances(t);
        const changed = ({ grievanceId, status }) => {
          setGrievances(prev => prev.map(g => g._id === grievanceId ? { ...g, status } : g));
          loadGrievances(t); push('Your grievance is now "' + status + '"', status === "Resolved" ? "success" : "info");
        };
        socket.on("connect", reconnect); socket.on("grievance:statusChanged", changed);
        cleanup = () => { socket.off("connect", reconnect); socket.off("grievance:statusChanged", changed); };
      } catch(e: any) { if (!cancelled) setLoadError(e.message); }
    })();
    return () => { cancelled = true; invalidateFeed(); cleanup(); };
  }, [router, loadGrievances, push, invalidateFeed]);

  if (!user) return <main className="p-8 text-slate-soft">{loadError || "Loading your workspace…"}</main>;

  const activeCount = activeTotal;

  return (
    <div className="min-h-screen">
      <Navbar userName={user.name} role="student" onOpenGrievance={setSelectedGrievance}/>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="glass-card p-8 text-center sm:text-left animate-rise">
          <p className="text-sm text-slate-soft">Welcome back, {user.name.split(" ")[0]}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            What&apos;s happening on campus?
          </h1>
          <p className="text-slate-soft mt-2">
            {activeCount === 0
              ? "You have no open grievances right now."
              : `${activeCount} grievance${activeCount === 1 ? "" : "s"} being tracked.`}
          </p>
          <a
            href="#report-form"
            className="inline-block mt-5 bg-signal text-ink font-semibold rounded-lg px-6 py-2.5 hover:bg-signal-dim transition-colors"
          >
            Report an issue
          </a>
        </div>

        <GrievanceForm token={token!} onSubmitted={() => loadGrievances(token!)} onOpenGrievance={setSelectedGrievance} />

        <div>
          {loadError && <p role="alert" className="text-critical text-sm mb-3">{loadError}<button className="underline ml-2" onClick={() => { setLoadError(""); loadGrievances(token!); }}>Retry</button></p>}
          <h2 className="font-display text-lg font-semibold mb-3">Your grievances</h2>
          {loading ? (
            <SkeletonFeed />
          ) : grievances.length === 0 ? (
            <p className="text-slate-soft text-sm">Nothing submitted yet — report an issue above.</p>
          ) : (
            <div className="space-y-3">
              {grievances.map((g, i) => (
                <div key={g._id}><GrievanceCard grievance={g} index={i}/><button className="cp-secondary mt-2" onClick={() => setSelectedGrievance(g._id)}>Evidence, feedback & details</button></div>
              ))}
            </div>
          )}
        </div>
        {cursor && <button className="cp-secondary" onClick={async () => { try { pages.current++; await loadGrievances(token!); } catch(e: any) { setLoadError(e.message); } }}>Load older grievances</button>}
        <CampusHub admin={false} onOpenGrievance={setSelectedGrievance}/>
      </main>
      {selectedGrievance && <GrievanceDetailPanel id={selectedGrievance} admin={false} onClose={() => setSelectedGrievance(null)} onChanged={() => loadGrievances(token!)}/>}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
