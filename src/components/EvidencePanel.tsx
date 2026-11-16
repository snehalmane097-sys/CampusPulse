"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/client";
import { FILE_LIMITS } from "@/lib/mediaLimits";
import { evidenceScanLabel, evidenceReviewLabel } from "@/lib/evidencePresentation";
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
  const [loading,setLoading]=useState(true);
  const invalidate = useCallback(() => { ++version.current; }, []);
  const load = useCallback(async () => { const current = ++version.current; try { const result = await api(`/api/grievances/${grievanceId}/attachments`); if (current === version.current) { setItems(result.attachments); setError(""); } } catch(e: any) { if (current === version.current) setError(e.message); } finally {if(current===version.current)setLoading(false);} }, [grievanceId]);
  useEffect(() => { setItems([]);setPreview(null);setLoading(true);load(); const timer = setInterval(load, 5000); return () => { invalidate(); clearInterval(timer); }; }, [load, invalidate]);
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); await load(); } catch(e: any) { setError(e.message); } finally { setBusy(false); } }
  return <section className="space-y-4 border-t border-ink-line pt-5" aria-labelledby="complaint-evidence-heading"><h3 id="complaint-evidence-heading" className="font-display text-lg">Evidence</h3>
    <p className="text-xs text-slate-soft">JPEG, PNG, WebP (10 MB), PDF (20 MB), MP4 (100 MB). Up to 10 files / 200 MB per grievance. Files become available after security checks. File contents can reveal identity; check them before uploading anonymously.</p>
    <details open={!admin}><summary className="cursor-pointer text-sm font-medium">Add evidence</summary><div className="flex gap-2 flex-wrap mt-3"><input aria-label="Add evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm max-w-full"/><button type="button" disabled={!file || busy} className="cp-primary" onClick={() => act(async () => { const control = new AbortController(); setController(control); try {await uploadEvidence(grievanceId, file!, setProgress, control.signal); setFile(null);} finally{setController(null);} })}>Upload evidence</button>{busy && controller && <button type="button" className="cp-secondary" onClick={() => controller.abort()}>Cancel</button>}</div></details>
    {busy && controller && <progress aria-label="Upload progress" value={progress} max="100" className="w-full accent-signal"/>}{error && <p role="alert" className="text-critical text-sm">{error}<button type="button" className="underline ml-2" onClick={load}>Retry evidence</button></p>}
    {loading&&<p role="status" className="text-sm text-slate-soft">Loading evidence.</p>}
    {!loading&&!items.length && <p className="text-sm text-slate-soft">No evidence attached yet.</p>}
    {items.map(a => <article key={a._id} className="border border-ink-line rounded-xl p-3 space-y-2">
      <div className="flex justify-between gap-2"><p className="text-sm break-all">{a.name}</p><span className="text-xs text-slate-soft shrink-0">{(a.size / 1048576).toFixed(1)} MB</span></div>
      <p className="text-xs text-slate-soft">{a.mime} · {evidenceScanLabel(a)}</p><p className={`text-sm font-medium ${a.review==="accepted"?"text-signal":a.review==="rejected"?"text-critical":"text-amber"}`}>{evidenceReviewLabel(a.review)}</p>{a.error && <p className="text-critical text-xs">{a.error}</p>}{a.reviewNote && <p className="text-sm whitespace-pre-wrap break-words">Review note: {a.reviewNote}</p>}
      <div className="flex gap-4 text-xs">{a.state === "clean" && <><button className="text-signal" onClick={() => setPreview(preview === a._id ? null : a._id)}>Preview</button><a href={`/api/attachments/${a._id}/access`} target="_blank" rel="noreferrer" className="text-signal">Open file</a></>}<button disabled={busy} className="text-critical" onClick={() => { if (confirm("Remove this evidence? Reviewed evidence can only be removed by an administrator.")) act(async () => { await api(`/api/attachments/${a._id}`, "DELETE"); }); }}>Remove</button></div>
      {a.state==="clean"&&a.mime.startsWith("image/")&&<img alt={`Evidence preview: ${a.name}`} loading="lazy" src={`/api/attachments/${a._id}/access`} className="w-full max-h-64 object-contain rounded-lg bg-black/10"/>}
      {a.state==="clean"&&preview === a._id && !a.mime.startsWith("image/") && (a.mime === "video/mp4" ? <video controls preload="metadata" className="w-full max-h-96" src={`/api/attachments/${a._id}/access`}/> : <iframe title="PDF evidence preview" sandbox="" className="w-full h-96 bg-white" src={`/api/attachments/${a._id}/access`}/>)}
      {admin && a.state === "clean" && <div className="space-y-2"><label className="block text-xs text-slate-soft">Review note (required to reject)<input aria-label={`Review note for ${a.name}`} className="cp-input mt-1" maxLength={2000} placeholder="Explain your evidence review" value={notes[a._id] || ""} onChange={e => setNotes({ ...notes, [a._id]: e.target.value })}/></label><div className="flex gap-2 flex-wrap">{["accepted","rejected"].map(review => <button type="button" key={review} disabled={busy||(review==="rejected"&&!notes[a._id]?.trim())} className={review==="accepted"?"cp-primary":"cp-secondary"} onClick={() => act(async () => { await api(`/api/attachments/${a._id}/review`, "PATCH", { review, reviewNote: notes[a._id] || "" }); })}>{review === "accepted" ? "Accept" : "Reject"}</button>)}</div></div>}
    </article>)}
  </section>;
}
