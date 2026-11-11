import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { privateRoot } from "./storage";
export async function sendEmail(to: string, subject: string, message: string, key: string) {
  const driver = process.env.EMAIL_DRIVER || "development";
  if (driver === "development") {
    if (process.env.NODE_ENV === "production") throw new Error("Configure an email provider in production.");
    const dir = path.join(privateRoot(), "mail"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${key.replace(/[^a-zA-Z0-9-]/g, "_")}.json`), JSON.stringify({ developmentOnly: true, to, subject, message }, null, 2), { mode: 0o600 });
    return;
  }
  if (driver !== "resend" || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("Email configuration is incomplete.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: message }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}.`);
}
