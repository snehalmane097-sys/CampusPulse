"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { readFeedWindow } from "@/lib/feedWindow";
import { api } from "@/lib/client";
import { getSocket } from "@/lib/socketClient";
import { IconBell } from "./Icons";
import Dialog from "./Dialog";
export default function NotificationCenter({ onOpenGrievance }: { onOpenGrievance?: (id: string) => void }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<any[]>([]), [count, setCount] = useState(0), [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState("");
  const [prefs, setPrefs] = useState<any>(null), [code, setCode] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [unread, setUnread] = useState(false);
  const pages = useRef(1), revision = useRef(0);
  const invalidate = useCallback(() => { ++revision.current; }, []);
  const load = useCallback(async () => {
    const version = ++revision.current;
    try { const [inbox, total] = await Promise.all([open ? readFeedWindow(api, `/api/notifications${unread ? "?unread=true" : ""}`, "notifications", pages.current) : Promise.resolve(null), api("/api/notifications/unread-count")]); if (version !== revision.current) return; if (inbox) { setItems(inbox.notifications); setCursor(inbox.nextCursor); } setCount(total.count); setError(""); } catch(e: any) { if (version === revision.current) setError(e.message); }
  }, [unread, open]);
  useEffect(() => {
    load(); const socket = getSocket(); socket.on("notification:changed", load); socket.on("connect", load);
    const timer = setInterval(load, 30000);
    return () => { invalidate(); socket.off("notification:changed", load); socket.off("connect", load); clearInterval(timer); };
  }, [load, invalidate]);
  async function action(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); } catch(e: any) { setError(e.message); } finally { setBusy(false); } }
  return <>
    <button className="cp-secondary relative flex gap-2 items-center" aria-label={`Notifications, ${count} unread`} onClick={() => { setOpen(true); load(); api("/api/notifications/preferences").then(setPrefs).catch(e => setError(e.message)); }}><IconBell className="w-4 h-4"/><span className="hidden sm:inline">Inbox</span>{count > 0 && <span className="rounded-full bg-signal text-ink text-xs px-1.5">{count > 99 ? "99+" : count}</span>}</button>
    {open && <Dialog title="Notification center" onClose={() => setOpen(false)}>
      <div className="flex justify-between gap-3 items-center"><label className="text-sm"><input type="checkbox" checked={unread} onChange={e => { pages.current = 1; setItems([]); setUnread(e.target.checked); }} className="mr-2 accent-signal"/>Unread only</label><button disabled={busy} className="cp-secondary" onClick={() => action(async () => { await api("/api/notifications/read-all", "PATCH"); await load(); })}>Mark all read</button></div>
      {error && <p role="alert" className="text-critical">{error}</p>}{notice && <p role="status" className="text-signal text-sm">{notice}</p>}
      {!items.length && <p className="text-slate-soft py-8 text-center">Your inbox is up to date.</p>}
      <div className="space-y-2">{items.map(n => <article key={n._id} className={`rounded-xl border p-4 ${n.read ? "border-white/10" : "border-signal/40 bg-signal/5"}`}>
        <div className="flex items-start justify-between gap-3"><h3 className="font-medium">{n.title || "CampusPulse update"}</h3><time className="text-xs text-slate-soft">{new Date(n.createdAt).toLocaleDateString()}</time></div>
        <p className="text-sm whitespace-pre-wrap mt-2 break-words">{n.message}</p><div className="mt-3 flex gap-3">{!n.read && <button disabled={busy} className="text-signal text-xs" onClick={() => action(async () => { await api(`/api/notifications/${n._id}/read`, "PATCH"); await load(); })}>Mark read</button>}{n.grievance && onOpenGrievance && <button className="text-signal text-xs" onClick={() => { setOpen(false); onOpenGrievance(n.grievance); }}>View grievance</button>}</div>
      </article>)}</div>
      {cursor && <button className="cp-secondary w-full" disabled={busy} onClick={() => action(async () => { pages.current++; await load(); })}>Load older notifications</button>}
      {prefs && <section className="border-t border-white/10 pt-4 space-y-3"><h3 className="font-medium">Email preferences</h3><p className="text-xs text-slate-soft">Department: {prefs.department || prefs.academicDepartment}. Contact your administrator to correct your department.</p>
        <label className="text-sm flex gap-2"><input type="checkbox" checked={prefs.emailNotifications} disabled={busy} onChange={e => { const checked = e.target.checked; action(async () => { await api("/api/notifications/preferences", "PATCH", { emailNotifications: checked }); setPrefs({ ...prefs, emailNotifications: checked }); }); }}/>Email me about updates</label>
        {prefs.emailVerified ? <p className="text-signal text-sm">Email verified</p> : <div className="space-y-2"><p className="text-xs text-amber">Verify your email before receiving grievance notifications.</p><button className="cp-secondary" disabled={busy} onClick={() => action(async () => { const r = await api("/api/auth/email-verification", "POST", {}); setNotice(r.message); })}>Send verification email</button><div className="flex gap-2"><input aria-label="Email verification code" value={code} onChange={e => setCode(e.target.value)} className="cp-input" placeholder="Paste verification code"/><button className="cp-secondary" disabled={busy || code.length !== 64} onClick={() => action(async () => { const r = await api("/api/auth/email-verification", "POST", { token: code }); setNotice(r.message); setPrefs({ ...prefs, emailVerified: true }); })}>Verify</button></div></div>}
      </section>}
    </Dialog>}
  </>;
}
