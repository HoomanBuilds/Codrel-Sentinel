"use client";

import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Toast = {
  id: number;
  type: "success" | "error";
  message: string;
};

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: Omit<Toast, "id">) => {
    const id = Date.now();
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => {
      setToasts((p) => p.filter((x) => x.id !== id));
    }, 3000);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-3 py-2 rounded-md border bg-[#111] text-xs font-mono shadow-lg
              border-neutral-800 animate-in fade-in slide-in-from-bottom-2"
          >
            {t.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-neutral-200">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
