import type { ReactNode } from "react";
export default function PortalHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
    <div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-signal mb-3">{eyebrow}</p><h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{title}</h1><p className="text-sm sm:text-base text-slate-soft leading-relaxed mt-3">{description}</p></div>{children&&<div className="shrink-0">{children}</div>}
  </div>;
}
