"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
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
      <div className="glass-card max-w-md w-full p-6 sm:p-9">
        <Link href="/" aria-label="CampusPulse home" className="inline-block mb-8"><Brand/></Link><ThemeToggle/>

        <h1 className="font-display text-3xl font-semibold mb-2">Create an account</h1>
        <p className="text-slate-soft mb-8">Report and track campus issues.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" id="register-name">
            <input
              id="register-name"
              autoComplete="name"
              disabled={loading}
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="cp-input"
            />
          </Field>
          <Field label="Email" id="register-email">
            <input
              id="register-email"
              autoComplete="username"
              disabled={loading}
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="cp-input"
            />
          </Field>
          <Field label="Password" id="register-password">
            <input
              id="register-password"
              autoComplete="new-password"
              disabled={loading}
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
            className="cp-primary w-full py-3"
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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}
