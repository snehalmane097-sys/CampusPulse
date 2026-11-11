"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { disconnectSocket } from "@/lib/socketClient";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      router.push("/student");
    } catch {
      setError("Could not reach the server. Is it running?");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-10">
          <span className="w-2.5 h-2.5 rounded-full bg-signal shadow-[0_0_12px_2px_rgba(62,217,163,0.6)]" />
          <span className="font-display font-semibold tracking-tight text-lg">CampusPulse</span>
        </div>

        <h1 className="font-display text-3xl font-semibold mb-2">Create an account</h1>
        <p className="text-slate-soft mb-8">Report and track campus issues.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name">
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="cp-input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="cp-input"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={10}
              maxLength={72}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="cp-input"
            />
          </Field>

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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-slate-soft mt-6">
          Already have an account?{" "}
          <Link href="/" className="text-signal hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-soft mb-1.5">{label}</label>
      {children}
    </div>
  );
}
