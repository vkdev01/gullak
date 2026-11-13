"use client";

import { useEffect } from "react";
import s from "./Toast.module.scss";

export type ToastState = {
  id: number;
  message: string;
  tone?: "ok" | "error";
  actions?: { label: string; run: () => void | Promise<void> }[];
} | null;

/** One message at the bottom of the screen, with actions such as Undo. Dismisses itself. */
export default function Toast({ toast, onClose, seconds = 9 }: { toast: ToastState; onClose: () => void; seconds?: number }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose, seconds]);

  if (!toast) return null;

  return (
    <div className={`${s.toast} ${toast.tone === "error" ? s.error : ""}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span>{toast.message}</span>
      {toast.actions?.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={async () => {
            onClose();
            await a.run();
          }}
        >
          {a.label}
        </button>
      ))}
      <button type="button" className={s.close} onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
