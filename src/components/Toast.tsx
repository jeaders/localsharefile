"use client";

import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="toast">
      <CheckCircle2 size={16} />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Chiudi notifica">
        <X size={13} />
      </button>
    </div>
  );
}
