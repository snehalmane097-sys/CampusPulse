export default function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex items-center gap-3">
    <span className={`grid ${compact?"h-9 w-9":"h-10 w-10"} shrink-0 place-items-center rounded-xl bg-signal text-ink`} aria-hidden="true"><svg width="25" height="25" viewBox="0 0 32 32" fill="none"><path d="M4 17h6l3-9 5 17 3-8h7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
    <span><span className={`block font-display ${compact?"text-lg":"text-xl"} font-bold tracking-tight text-ivory`}>CampusPulse<span className="text-signal">.</span></span>{!compact&&<span className="block text-[10px] tracking-[0.14em] uppercase text-slate-soft mt-0.5">A better connected campus</span>}</span>
  </span>;
}
