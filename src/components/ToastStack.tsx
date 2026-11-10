"use client";

import { Toast } from "@/lib/useToastQueue";
import { IconCheckCircle, IconBell, IconAlertTriangle } from "./Icons";

const TONE_STYLE: Record<Toast["tone"], string> = {
  success: "border-signal/30 bg-signal/10 text-signal",
  info: "border-cyan/30 bg-cyan/10 text-cyan",
  warning: "border-amber/30 bg-amber/10 text-amber",
};

const TONE_ICON: Record<Toast["tone"], React.ComponentType<{ className?: string }>> = {
  success: IconCheckCircle,
  info: IconBell,
  warning: IconAlertTriangle,
};

export default function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2 max-w-xs w-full">
      {toasts.map((t) => {
        const Icon = TONE_ICON[t.tone];
        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            className={`animate-toastIn cursor-pointer flex items-start gap-2.5 rounded-xl border px-4 py-3 backdrop-blur-xl bg-ink-panel/90 shadow-lg ${TONE_STYLE[t.tone]}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-sm text-ivory">{t.message}</p>
          </div>
        );
      })}
    </div>
  );
}
