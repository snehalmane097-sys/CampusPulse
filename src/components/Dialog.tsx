"use client";
import { useEffect, useRef, ReactNode } from "react";
export default function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const element = ref.current!; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === e.currentTarget) closeRef.current(); }} className="cp-dialog bg-ink-panel text-ivory rounded-2xl border border-white/10 p-0 w-[min(95vw,760px)] max-h-[90vh] backdrop:bg-black/75">
    <div className="sticky top-0 z-10 bg-ink-panel flex items-center justify-between gap-4 p-5 border-b border-white/10"><h2 className="font-display text-xl">{title}</h2><button autoFocus onClick={onClose} aria-label="Close dialog" className="cp-secondary">Close</button></div>
    <div className="p-5 space-y-5">{children}</div>
  </dialog>;
}
