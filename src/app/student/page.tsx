"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import GrievanceForm from "@/components/GrievanceForm";
import GrievanceCard from "@/components/GrievanceCard";
import ToastStack from "@/components/ToastStack";
import { SkeletonFeed } from "@/components/Skeletons";
import { GrievanceDTO } from "@/types";
import { getSocket } from "@/lib/socketClient";
import { useToastQueue } from "@/lib/useToastQueue";

export default function StudentDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [grievances, setGrievances] = useState<GrievanceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, push, dismiss } = useToastQueue();

  const loadGrievances = useCallback(async (authToken: string) => {
    const res = await fetch("/api/grievances", { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (res.ok) setGrievances(data.grievances);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("cp_token");
    const u = localStorage.getItem("cp_user");
    if (!t || !u) {
      router.push("/");
      return;
    }
    const parsedUser = JSON.parse(u);
    if (parsedUser.role !== "student") {
      router.push("/admin");
      return;
    }
    setToken(t);
    setUser(parsedUser);
    loadGrievances(t);

    const socket = getSocket();
    // Server verifies this token itself and decides room membership from
    // it — the client never gets to declare its own role. Re-join on
    // every (re)connect so a dropped connection doesn't silently stop
    // delivering status updates.
    socket.on("connect", () => socket.emit("join", { token: t }));
    if (socket.connected) socket.emit("join", { token: t });
    socket.on("grievance:statusChanged", ({ grievanceId, status }) => {
      setGrievances((prev) => prev.map((g) => (g._id === grievanceId ? { ...g, status } : g)));
      push(`Your grievance is now "${status}"`, status === "Resolved" ? "success" : "info");
    });

    return () => {
      socket.off("connect");
      socket.off("grievance:statusChanged");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadGrievances]);

  if (!user) return null;

  const activeCount = grievances.filter((g) => g.status !== "Resolved").length;

  return (
    <div className="min-h-screen">
      <Navbar userName={user.name} role="student" />
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

        <GrievanceForm token={token!} onSubmitted={() => loadGrievances(token!)} />

        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Your grievances</h2>
          {loading ? (
            <SkeletonFeed />
          ) : grievances.length === 0 ? (
            <p className="text-slate-soft text-sm">Nothing submitted yet — report an issue above.</p>
          ) : (
            <div className="space-y-3">
              {grievances.map((g, i) => (
                <GrievanceCard key={g._id} grievance={g} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
