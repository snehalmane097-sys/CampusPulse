"use client";

import { useRouter } from "next/navigation";
import { IconShield, IconSparkles } from "./Icons";
import NotificationCenter from "./NotificationCenter";
import { disconnectSocket } from "@/lib/socketClient";
import { api } from "@/lib/client";
import { useState } from "react";

export default function Navbar({ userName, role, onOpenGrievance }: { userName: string; role: "student" | "admin"; onOpenGrievance?: (id: string) => void }) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState(""), [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true); setLogoutError("");
    try { await api("/api/auth/logout", "POST", {}); }
    catch { setLogoutError("Sign out failed. Your session is still active. Please retry."); setLoggingOut(false); return; }
    disconnectSocket();
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_user");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-signal shadow-[0_0_12px_2px_rgba(62,217,163,0.6)]" />
          <span className="font-display font-semibold tracking-tight">CampusPulse</span>
          <span className="ml-3 flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-slate-soft uppercase">
            {role === "admin" ? <IconShield className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
            {role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <NotificationCenter onOpenGrievance={onOpenGrievance}/>
          <span className="text-sm text-slate-soft hidden sm:inline">{userName}</span>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="text-sm text-slate-soft hover:text-ivory border border-white/10 rounded-lg px-3 py-1.5 transition-colors hover:border-white/30"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
      {logoutError && <p role="alert" className="px-6 pb-3 text-sm text-critical">{logoutError}</p>}
    </header>
  );
}
