"use client";

import { useRouter } from "next/navigation";
import { IconShield, IconSparkles } from "./Icons";
import NotificationCenter from "./NotificationCenter";
import { disconnectSocket } from "@/lib/socketClient";
import { api } from "@/lib/client";
import { useState } from "react";
import Link from "next/link";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

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
    <header className="sticky top-0 z-20 border-b border-ink-line bg-ink-panel/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={role==="admin"?"/admin":"/student"} aria-label="CampusPulse workspace"><Brand compact/></Link>
          <span className="ml-3 hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-ink-raised text-slate-soft capitalize">
            {role === "admin" ? <IconShield className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
            {role}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle/><NotificationCenter onOpenGrievance={onOpenGrievance}/>
          <span className="text-sm text-slate-soft hidden sm:inline">{userName}</span>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="text-sm text-slate-soft hover:text-ivory border border-ink-line rounded-lg px-3 py-1.5 transition-colors hover:border-signal/35"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
      {logoutError && <p role="alert" className="px-6 pb-3 text-sm text-critical">{logoutError}</p>}
    </header>
  );
}
