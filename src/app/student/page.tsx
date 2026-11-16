"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import PortalHeading from "@/components/PortalHeading";
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
  const [reportTotal, setReportTotal] = useState(0);
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
      setGrievances(data.grievances); setCursor(data.nextCursor); setActiveTotal(data.summary.active); setReportTotal(data.summary.total); setLoadError("");
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
        socket.on("grievance:buildingChanged", reconnect); socket.on("connect", reconnect); socket.on("grievance:statusChanged", changed);
        cleanup = () => { socket.off("grievance:buildingChanged", reconnect); socket.off("connect", reconnect); socket.off("grievance:statusChanged", changed); };
      } catch(e: any) { if (!cancelled) setLoadError(e.message); }
    })();
    return () => { cancelled = true; invalidateFeed(); cleanup(); };
  }, [router, loadGrievances, push, invalidateFeed]);

  if (!user) return <main className="p-8 text-slate-soft">{loadError || "Loading your workspace…"}</main>;

  const activeCount = activeTotal;

  return <div className="min-h-screen">
    <Navbar userName={user.name} role="student" onOpenGrievance={setSelectedGrievance}/>
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
      <PortalHeading eyebrow={"Welcome back, "+user.name.split(" ")[0]} title="A better campus starts with you." description="Report a concern, add the details that matter and follow its progress from here."><a href="#report-form" className="cp-primary">Report an issue <span aria-hidden="true">＋</span></a></PortalHeading>
      <div className="flex flex-wrap items-center gap-6 sm:gap-10 border-y border-ink-line py-5"><div className="flex items-baseline gap-3"><strong className="font-display text-2xl">{loading?"—":activeCount}</strong><span className="text-sm text-slate-soft">Active complaints</span></div><div className="flex items-baseline gap-3"><strong className="font-display text-2xl">{loading?"—":reportTotal}</strong><span className="text-sm text-slate-soft">Total submitted</span></div><p className="text-xs text-slate-soft sm:ml-auto">Your reports. Your progress.</p></div>
      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8 items-start">
        <GrievanceForm token={token!} onSubmitted={()=>loadGrievances(token!)} onOpenGrievance={setSelectedGrievance}/>
        <section className="space-y-4 min-w-0"><div><p className="text-xs uppercase tracking-[0.14em] text-slate-soft mb-2">Track & follow up</p><h2 className="font-display text-xl font-semibold">Your complaints</h2></div>
          {loadError&&<p role="alert" className="text-critical text-sm">{loadError}<button className="underline ml-2" onClick={()=>{setLoadError("");loadGrievances(token!);}}>Retry</button></p>}
          {loading?<SkeletonFeed/>:grievances.length===0?<div className="cp-empty">No complaints submitted yet. Use the form to tell us what needs attention.</div>:<div className="space-y-4">{grievances.map(g=><GrievanceCard key={g._id} grievance={g} onOpen={setSelectedGrievance}/>)}</div>}
          {cursor&&<button className="cp-secondary w-full" onClick={async()=>{try{pages.current++;await loadGrievances(token!);}catch(e:any){setLoadError(e.message);}}}>Load older grievances</button>}
        </section>
      </div>
      <CampusHub admin={false} onOpenGrievance={setSelectedGrievance}/>
    </main>
    {selectedGrievance&&<GrievanceDetailPanel id={selectedGrievance} admin={false} onClose={()=>setSelectedGrievance(null)} onChanged={()=>loadGrievances(token!)}/>}
    <ToastStack toasts={toasts} onDismiss={dismiss}/>
  </div>;
}
