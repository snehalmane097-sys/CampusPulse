"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/client";
import { FILE_LIMITS } from "@/lib/mediaLimits";
export async function uploadEvidence(grievanceId: string, file: File, onProgress?: (value: number) => void, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Upload cancelled.");
  if (!FILE_LIMITS[file.type] || file.size < 1 || file.size > FILE_LIMITS[file.type] * 1048576) throw new Error("Unsupported file or file size exceeds the stated limit.");
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(b => b.toString(16).padStart(2,"0")).join("");
  const intent = await api(`/api/grievances/${grievanceId}/attachments`, "POST", { name: file.name, mime: file.type, size: file.size, checksum: hash });
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open(intent.uploadFields ? "POST" : "PUT", intent.uploadUrl); if (!intent.uploadFields) xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded/e.total*100)); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Please retry."));
      xhr.onerror = () => reject(new Error("Upload connection interrupted.")); xhr.onabort = () => reject(new Error("Upload cancelled.")); xhr.timeout = 180000; xhr.ontimeout = () => reject(new Error("Upload timed out."));
      signal?.addEventListener("abort", () => xhr.abort(), { once: true }); if (signal?.aborted) { reject(new Error("Upload cancelled.")); return; }
      if (intent.uploadFields) { const form = new FormData(); for (const [key,value] of Object.entries(intent.uploadFields)) form.append(key, String(value)); form.append("file", file); xhr.send(form); }
      else xhr.send(file);
    });
    await api(`/api/attachments/${intent.attachment._id}/complete`, "POST", {});
  } catch(e) {
    // A lost completion response may already have committed. Never delete accepted evidence speculatively.
    if (signal?.aborted) await api(`/api/attachments/${intent.attachment._id}`, "DELETE").catch(() => {});
    throw e;
  }
}
export default function EvidencePanel({ grievanceId, admin }: { grievanceId: string; admin: boolean }) {
  const [items, setItems] = useState<any[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [file, setFile] = useState<File | null>(null), [controller, setController] = useState<AbortController | null>(null), [preview, setPreview] = useState<string | null>(null), [notes, setNotes] = useState<Record<string,string>>({});
  const version = useRef(0);
  const invalidate = useCallback(() => { ++version.current; }, []);
  const load = useCallback(async () => { const current = ++version.current; try { const result = await api(`/api/grievances/${grievanceId}/attachments`); if (current === version.current) { setItems(result.attachments); setError(""); } } catch(e: any) { if (current === version.current) setError(e.message); } }, [grievanceId]);
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => { invalidate(); clearInterval(timer); }; }, [load, invalidate]);
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); await load(); } catch(e: any) { setError(e.message); } finally { setBusy(false); } }
  return <section className="space-y-3"><h3 className="font-display text-lg">Evidence & media</h3>
    <p className="text-xs text-slate-soft">JPEG, PNG, WebP (10 MB), PDF (20 MB), MP4 (100 MB). Up to 10 files / 200 MB per grievance. Files become available after security checks. File contents can reveal identity; check them before uploading anonymously.</p>
    <div className="flex gap-2 flex-wrap"><input aria-label="Add evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm max-w-full"/><button disabled={!file || busy} className="cp-primary" onClick={() => act(async () => { const control = new AbortController(); setController(control); await uploadEvidence(grievanceId, file!, setProgress, control.signal); setFile(null); setController(null); })}>Upload evidence</button>{busy && controller && <button className="cp-secondary" onClick={() => controller.abort()}>Cancel</button>}</div>
    {busy && <progress aria-label="Upload progress" value={progress} max="100" className="w-full accent-signal"/>}{error && <p role="alert" className="text-critical text-sm">{error}</p>}
    {!items.length && <p className="text-sm text-slate-soft">No evidence attached yet.</p>}
    {items.map(a => <article key={a._id} className="border border-white/10 rounded-xl p-3 space-y-2">
      <div className="flex justify-between gap-2"><p className="text-sm break-all">{a.name}</p><span className="text-xs text-slate-soft shrink-0">{(a.size / 1048576).toFixed(1)} MB</span></div>
      <p className="text-xs text-slate-soft">{a.state} · Review: {a.review}</p>{a.scan === "development-unscanned" && <p className="text-xs text-amber">Development file: malware scanning has not been performed.</p>}{a.error && <p className="text-critical text-xs">{a.error}</p>}{a.reviewNote && <p className="text-sm">Review note: {a.reviewNote}</p>}
      <div className="flex gap-4 text-xs">{a.state === "clean" && <><button className="text-signal" onClick={() => setPreview(preview === a._id ? null : a._id)}>Preview</button><a href={`/api/attachments/${a._id}/access`} target="_blank" rel="noreferrer" className="text-signal">Open file</a></>}<button disabled={busy} className="text-critical" onClick={() => { if (confirm("Remove this evidence? Reviewed evidence can only be removed by an administrator.")) act(async () => { await api(`/api/attachments/${a._id}`, "DELETE"); }); }}>Remove</button></div>
      {preview === a._id && (a.mime.startsWith("image/") ? <img alt="Grievance evidence" src={`/api/attachments/${a._id}/access`} className="max-h-96 object-contain rounded-lg"/> : a.mime === "video/mp4" ? <video controls preload="metadata" className="w-full max-h-96" src={`/api/attachments/${a._id}/access`}/> : <iframe title="PDF evidence preview" sandbox="" className="w-full h-96 bg-white" src={`/api/attachments/${a._id}/access`}/>)}
      {admin && a.state === "clean" && <div className="flex gap-2 flex-wrap"><input aria-label={`Review note for ${a.name}`} className="cp-input flex-1 min-w-40" maxLength={2000} placeholder="Review note (required for rejection)" value={notes[a._id] || ""} onChange={e => setNotes({ ...notes, [a._id]: e.target.value })}/>{["accepted","rejected"].map(review => <button key={review} disabled={busy} className="cp-secondary" onClick={() => act(async () => { await api(`/api/attachments/${a._id}/review`, "PATCH", { review, reviewNote: notes[a._id] || "" }); })}>{review === "accepted" ? "Accept" : "Reject"}</button>)}</div>}
    </article>)}
  </section>;
}
