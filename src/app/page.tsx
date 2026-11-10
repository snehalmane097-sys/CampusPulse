"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();
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
      localStorage.setItem("cp_token", data.token);
      localStorage.setItem("cp_user", JSON.stringify(data.user));
      router.push(data.user.role === "admin" ? "/admin" : "/student");
    } catch {
      setError("Could not reach the server. Is it running?");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: message + login */}
      <section className="flex flex-col justify-center px-8 sm:px-16 py-16">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-10">
            <span className="w-2.5 h-2.5 rounded-full bg-signal shadow-[0_0_12px_2px_rgba(62,217,163,0.6)]" />
            <span className="font-display font-semibold tracking-tight text-lg">CampusPulse</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-4">
            One Wi-Fi outage.
            <br />
            Twenty tickets.
            <br />
            <span className="text-signal">One incident.</span>
          </h1>
          <p className="text-slate-soft mb-10 leading-relaxed">
            CampusPulse reads every grievance as it lands, clusters the ones
            describing the same problem, scores what needs attention first,
            and routes it to the right department — live.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-soft mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-ink-panel border border-ink-line rounded-lg px-3.5 py-2.5 text-ivory placeholder:text-slate-soft/60 focus:border-signal outline-none transition-colors"
                placeholder="you@campus.edu"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-soft mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ink-panel border border-ink-line rounded-lg px-3.5 py-2.5 text-ivory placeholder:text-slate-soft/60 focus:border-signal outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-critical text-sm bg-critical/10 border border-critical/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-signal text-ink font-semibold rounded-lg py-2.5 hover:bg-signal-dim transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-sm text-slate-soft mt-6">
            New here?{" "}
            <Link href="/register" className="text-signal hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </section>

      {/* Right: radar hero — the literal "Campus Issue Radar" from the brief */}
      <section className="hidden lg:flex items-center justify-center bg-ink-panel relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(62,217,163,0.08),transparent_60%)]" />
        <div className="relative w-[420px] h-[420px]">
          {/* Concentric radar rings */}
          {[1, 2, 3, 4].map((r) => (
            <div
              key={r}
              className="absolute rounded-full border border-ink-line"
              style={{
                inset: `${r * 12.5}%`,
              }}
            />
          ))}

          {/* Sweep line */}
          <div className="absolute inset-0 animate-sweep origin-center">
            <div className="absolute top-1/2 left-1/2 w-1/2 h-[2px] bg-gradient-to-r from-signal to-transparent origin-left" />
          </div>

          {/* Hotspot blips, sized/positioned like the PDF's Block A/B/C example */}
          <Blip top="30%" left="42%" size="w-3 h-3" label="Block A" intensity="low" />
          <Blip top="58%" left="65%" size="w-4 h-4" label="Block B" intensity="mid" />
          <Blip top="68%" left="35%" size="w-6 h-6" label="Block C" intensity="high" />

          <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ivory" />
        </div>

        <div className="absolute bottom-10 left-10 right-10 font-mono text-xs text-slate-soft flex justify-between">
          <span>SCAN: CAMPUS_GRID</span>
          <span className="text-signal">3 ACTIVE HOTSPOTS</span>
        </div>
      </section>
    </main>
  );
}

function Blip({
  top,
  left,
  size,
  label,
  intensity,
}: {
  top: string;
  left: string;
  size: string;
  label: string;
  intensity: "low" | "mid" | "high";
}) {
  const color =
    intensity === "high" ? "bg-critical" : intensity === "mid" ? "bg-amber" : "bg-signal";
  return (
    <div className="absolute" style={{ top, left }}>
      <span className={`absolute inline-flex rounded-full ${color} opacity-60 animate-ping1 ${size}`} />
      <span className={`relative inline-flex rounded-full ${color} ${size}`} />
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap text-[10px] font-mono text-slate-soft">
        {label}
      </span>
    </div>
  );
}
