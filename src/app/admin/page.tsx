"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import IncidentCard from "@/components/IncidentCard";
import IncidentDetailModal from "@/components/IncidentDetailModal";
import EarlyWarningPanel from "@/components/EarlyWarningPanel";
import ToastStack from "@/components/ToastStack";
import AnimatedCounter from "@/components/AnimatedCounter";
import { SkeletonFeed, SkeletonKPIs } from "@/components/Skeletons";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { CategoryChart, PriorityChart, TrendChart, LocationChart } from "@/components/AnalyticsCharts";
import { IconLayers, IconActivity, IconRadar, IconChart, IconAlertTriangle, IconCheckCircle } from "@/components/Icons";
import { GrievanceDTO, IncidentDTO, IncidentDetailDTO, AnalyticsDTO, GrievanceStatus } from "@/types";
import { getSocket } from "@/lib/socketClient";
import { useToastQueue } from "@/lib/useToastQueue";

// Leaflet touches window at import time, so it must be a client-only,
// SSR-disabled dynamic import inside the Next.js app router.
const CampusMap = dynamic(() => import("@/components/CampusMap"), { ssr: false });

type Tab = "overview" | "feed" | "incidents" | "map" | "analytics" | "warnings";

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [grievances, setGrievances] = useState<GrievanceDTO[]>([]);
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetailDTO | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToastQueue();

  // Refetching every field on every socket event would work, but a burst of
  // near-simultaneous events (e.g. three similar complaints landing within
  // seconds) would otherwise fire one API round-trip per event. This ref +
  // timeout coalesces any events within 400ms into a single refresh.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const loadAll = useCallback(async (authToken: string) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const [gRes, iRes, aRes] = await Promise.all([
      fetch("/api/grievances", { headers }),
      fetch("/api/incidents", { headers }),
      fetch("/api/analytics", { headers }),
    ]);
    if (gRes.ok) setGrievances((await gRes.json()).grievances);
    if (iRes.ok) setIncidents((await iRes.json()).incidents);
    if (aRes.ok) setAnalytics(await aRes.json());
    setLoading(false);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (tokenRef.current) loadAll(tokenRef.current);
    }, 400);
  }, [loadAll]);

  useEffect(() => {
    const t = localStorage.getItem("cp_token");
    const u = localStorage.getItem("cp_user");
    if (!t || !u) {
      router.push("/");
      return;
    }
    const parsedUser = JSON.parse(u);
    if (parsedUser.role !== "admin") {
      router.push("/student");
      return;
    }
    setToken(t);
    tokenRef.current = t;
    setUser(parsedUser);
    loadAll(t);

    const socket = getSocket();
    // Server verifies this token and decides room membership itself — the
    // client never gets to just claim "isAdmin". Re-join on every
    // (re)connect so a dropped connection doesn't silently go stale.
    socket.on("connect", () => socket.emit("join", { token: t }));
    if (socket.connected) socket.emit("join", { token: t });

    socket.on("grievance:new", ({ grievance }: { grievance: GrievanceDTO }) => {
      setGrievances((prev) => [grievance, ...prev]);
      push(`New ${grievance.category.toLowerCase()} report — ${grievance.location}`, "info");
      scheduleRefresh();
    });
    socket.on(
      "grievance:statusChanged",
      ({ grievanceId, status }: { grievanceId: string; status: GrievanceStatus }) => {
        setGrievances((prev) => prev.map((g) => (g._id === grievanceId ? { ...g, status } : g)));
        scheduleRefresh();
      }
    );
    socket.on("incident:updated", (payload: { status?: GrievanceStatus }) => {
      if (payload?.status === "Resolved") push("An incident was fully resolved.", "success");
      scheduleRefresh();
    });

    return () => {
      socket.off("connect");
      socket.off("grievance:new");
      socket.off("grievance:statusChanged");
      socket.off("incident:updated");
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadAll, scheduleRefresh]);

  async function updateStatus(id: string, status: GrievanceStatus) {
    const res = await fetch(`/api/grievances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setGrievances((prev) => prev.map((g) => (g._id === id ? { ...g, status } : g)));
      push(`Status updated to "${status}"`, "success");
      scheduleRefresh();
    } else {
      push("Could not update status — please retry.", "warning");
    }
  }

  async function openIncident(id: string) {
    const res = await fetch(`/api/incidents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSelectedIncident((await res.json()).incident);
  }

  if (!user) return null;

  const criticalCount = grievances.filter((g) => g.priorityLabel === "Critical" && g.status !== "Resolved").length;

  return (
    <div className="min-h-screen">
      <Navbar userName={user.name} role="admin" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {loading ? (
          <SkeletonKPIs />
        ) : (
          <KPIStrip analytics={analytics} criticalCount={criticalCount} />
        )}

        <nav className="flex gap-1.5 border-b border-white/10 overflow-x-auto">
          {(
            [
              ["overview", "Overview", IconActivity],
              ["feed", "Live Feed", IconLayers],
              ["incidents", "Incidents", IconLayers],
              ["map", "Campus Radar", IconRadar],
              ["analytics", "Analytics", IconChart],
              ["warnings", "Early Warnings", IconAlertTriangle],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === key ? "border-signal text-signal" : "border-transparent text-slate-soft hover:text-ivory"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="space-y-6">
            <EarlyWarningPanel warnings={analytics?.earlyWarnings ?? []} />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="font-display font-semibold mb-3">Most urgent incidents</h3>
                {incidents.length === 0 ? (
                  <p className="text-sm text-slate-soft">No active incidents right now.</p>
                ) : (
                  <div className="space-y-3">
                    {incidents.slice(0, 3).map((inc, i) => (
                      <IncidentCard key={inc._id} incident={inc} index={i} onClick={() => openIncident(inc._id)} />
                    ))}
                  </div>
                )}
              </div>
              <div className="glass-card p-5">
                <h3 className="font-display font-semibold mb-2">Reports over time</h3>
                {analytics && <TrendChart data={analytics.trend} />}
              </div>
            </div>
            {analytics && <CampusMap data={analytics} />}
          </div>
        )}

        {tab === "feed" && (
          <div className="space-y-3">
            {loading ? (
              <SkeletonFeed />
            ) : grievances.length === 0 ? (
              <p className="text-slate-soft text-sm">No grievances yet.</p>
            ) : (
              grievances.map((g, i) => (
                <div
                  key={g._id}
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                  className="glass-card p-4 animate-rise"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed flex-1 break-words">
                      {g.rawText}
                      {g.isAnonymous && (
                        <span className="ml-2 text-xs text-slate-soft font-mono">(anonymous)</span>
                      )}
                    </p>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedReasons(expandedReasons === g._id ? null : g._id)}
                      className="inline-flex"
                      title="Why this priority?"
                    >
                      <PriorityBadge priority={g.priorityLabel} score={g.priorityScore} />
                    </button>
                    <span className="text-xs font-mono text-slate-soft border border-white/10 rounded-full px-2.5 py-1">
                      {g.category}
                    </span>
                    <span className="text-xs font-mono text-slate-soft border border-white/10 rounded-full px-2.5 py-1">
                      {g.location}
                    </span>
                    <span className="text-xs font-mono text-slate-soft border border-white/10 rounded-full px-2.5 py-1">
                      → {g.department}
                    </span>
                    {g.affectedCount > 1 && (
                      <span className="text-xs font-mono text-amber border border-amber/30 bg-amber/10 rounded-full px-2.5 py-1">
                        {g.affectedCount} linked reports
                      </span>
                    )}

                    <div className="ml-auto flex gap-1.5 flex-wrap">
                      {(["Pending", "In Progress", "Resolved"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(g._id, s)}
                          disabled={g.status === s}
                          className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                            g.status === s
                              ? "border-signal/30 text-signal/60 cursor-default"
                              : "border-white/10 text-slate-soft hover:border-signal hover:text-signal"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {expandedReasons === g._id && g.priorityReasons && g.priorityReasons.length > 0 && (
                    <ul className="mt-3 text-xs text-slate-soft space-y-1 border-t border-white/10 pt-3">
                      {g.priorityReasons.map((r, ri) => (
                        <li key={ri}>• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "incidents" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {incidents.length === 0 && (
              <p className="text-slate-soft text-sm col-span-2">
                No clustered incidents right now — related complaints will appear here automatically.
              </p>
            )}
            {incidents.map((inc, i) => (
              <IncidentCard key={inc._id} incident={inc} index={i} onClick={() => openIncident(inc._id)} />
            ))}
          </div>
        )}

        {tab === "map" && analytics && <CampusMap data={analytics} />}

        {tab === "analytics" && analytics && (
          <div className="grid md:grid-cols-2 gap-6">
            <Panel title="Grievances by category">
              <CategoryChart data={analytics.categoryDistribution} />
            </Panel>
            <Panel title="Priority distribution">
              <PriorityChart data={analytics.priorityDistribution} />
            </Panel>
            <Panel title="Reports by location">
              <LocationChart data={analytics.hotspots} />
            </Panel>
            <Panel title="Grievances over time">
              <TrendChart data={analytics.trend} />
            </Panel>
          </div>
        )}

        {tab === "warnings" && <EarlyWarningPanel warnings={analytics?.earlyWarnings ?? []} />}
      </main>

      <IncidentDetailModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function KPIStrip({ analytics, criticalCount }: { analytics: AnalyticsDTO | null; criticalCount: number }) {
  const stats = [
    { label: "Total reports", value: analytics?.total ?? 0, icon: IconLayers, tone: "text-cyan" },
    { label: "Active", value: analytics?.active ?? 0, icon: IconActivity, tone: "text-amber" },
    { label: "Critical now", value: criticalCount, icon: IconAlertTriangle, tone: "text-critical" },
    { label: "Resolved", value: analytics?.resolved ?? 0, icon: IconCheckCircle, tone: "text-signal" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{ animationDelay: `${i * 60}ms` }}
          className="glass-card glass-card-hover p-4 animate-rise"
        >
          <div className="flex items-center justify-between">
            <p className="text-2xl font-display font-semibold">
              <AnimatedCounter value={s.value} />
            </p>
            <s.icon className={`w-4 h-4 ${s.tone}`} />
          </div>
          <p className="text-xs text-slate-soft mt-1">{s.label}</p>
        </div>
      ))}
      <div className="col-span-2 sm:col-span-4 glass-card p-3 text-xs text-slate-soft flex items-center justify-between">
        <span>Average resolution time</span>
        <span className="text-ivory font-medium">
          {analytics ? `${analytics.avgResolutionHours}h` : "—"}
        </span>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h3 className="font-display font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
