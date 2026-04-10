"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastType = "ok" | "err" | "inf";
interface ToastMsg { id: number; msg: string; type: ToastType; }

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const toast = useCallback((msg: string, type: ToastType = "err") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            "px-4 py-3 rounded-xl text-sm font-medium shadow-lg text-white animate-in slide-in-from-right",
            t.type === "ok" && "bg-emerald-700",
            t.type === "inf" && "bg-teal-800",
            t.type === "err" && "bg-red-700",
          )}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
