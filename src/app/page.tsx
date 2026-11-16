"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import CampusIllustration from "@/components/CampusIllustration";
import { disconnectSocket } from "@/lib/socketClient";

export default function LandingPage() {
  const router = useRouter();
  const [entry, setEntry] = useState<"student" | "admin">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      disconnectSocket();
      localStorage.setItem("cp_token", data.token);
      localStorage.setItem("cp_user", JSON.stringify(data.user));
      router.push(data.user.role === "admin" ? "/admin" : "/student");
    } catch {
      setError("Could not reach the server. Is it running?");
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-ink">
    <header className="max-w-7xl mx-auto px-5 sm:px-10 py-6 flex flex-wrap gap-4 justify-between items-center"><Brand/><ThemeToggle/><span className="text-xs text-slate-soft">Vishwakarma Institute of Technology · Bibwewadi</span></header>
    <div className="max-w-7xl mx-auto px-5 sm:px-10 pt-8 lg:pt-16 pb-12 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-20 items-center">
      <section className="max-w-xl">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-signal mb-5">Your campus. Your voice.</p>
        <h1 className="font-display text-[clamp(2.8rem,5.5vw,4.7rem)] font-semibold tracking-[-0.045em] leading-[1.08]">Small concerns.<br/><span className="text-signal">Better campus.</span></h1>
        <p className="text-base sm:text-lg text-slate-soft leading-relaxed max-w-md mt-6">Raise campus concerns, share evidence and follow every update. One clear path from reporting an issue to seeing it resolved.</p>
        <CampusIllustration/>
        <div className="flex items-center gap-3 text-xs text-slate-soft mt-1"><span className="h-px w-8 bg-accent/50"/>Report. Track. Resolve.</div>
      </section>
      <section className="glass-card p-6 sm:p-9 lg:p-10 w-full max-w-lg mx-auto" aria-label="CampusPulse sign in">
        <div role="group" aria-label="Login entry point" className="grid grid-cols-2 gap-1 bg-ink-raised/70 rounded-xl p-1 mb-8">{(["student","admin"] as const).map(v=><button key={v} type="button" aria-pressed={entry===v} onClick={()=>{setEntry(v);setError("");}} className={entry===v?"rounded-lg bg-ink-panel shadow-sm px-3 py-2.5 text-sm font-semibold text-signal":"rounded-lg px-3 py-2.5 text-sm text-slate-soft"}>{v==="student"?"Student Login":"Admin Login"}</button>)}</div>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-soft mb-2">{entry==="student"?"Student workspace":"Campus administration"}</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-slate-soft mt-2 mb-7">{entry==="student"?"Sign in to submit and track your complaints.":"Sign in to review issues and coordinate resolutions."}</p>
        <form onSubmit={handleLogin} className="space-y-5">
          <div><label className="block text-sm font-medium mb-2" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required disabled={loading} value={email} onChange={e=>setEmail(e.target.value)} className="cp-input" placeholder="you@campus.edu"/></div>
          <div><label className="block text-sm font-medium mb-2" htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required disabled={loading} value={password} onChange={e=>setPassword(e.target.value)} className="cp-input" placeholder="Enter your password"/></div>
          {error&&<p role="alert" className="text-critical text-sm bg-critical/5 rounded-xl px-3 py-3">{error}</p>}
          <button type="submit" disabled={loading} className="cp-primary w-full py-3">{loading?"Signing in…":entry==="student"?"Sign in to Student portal":"Sign in to Admin portal"}<span aria-hidden="true">→</span></button>
        </form>
        <p className="text-xs text-slate-soft leading-relaxed mt-5">Access follows the role assigned to your account.</p>
        <div className="border-t border-ink-line mt-7 pt-5 text-sm">{entry==="student"?<p className="text-slate-soft">New to CampusPulse? <Link href="/register" className="text-signal font-medium hover:underline">Create a student account</Link></p>:<p className="text-slate-soft">Admin access is provisioned by your campus team.</p>}</div>
      </section>
    </div>
    <footer className="max-w-7xl mx-auto px-5 sm:px-10 pb-7 flex flex-wrap justify-between gap-3 text-xs text-slate-soft"><span>CampusPulse · Campus grievance management</span><span>Built around a better campus experience.</span></footer>
  </main>;
}
