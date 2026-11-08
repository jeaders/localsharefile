"use client";

import { useEffect, useRef } from "react";
import type { IncomingSignal } from "@/lib/client/types";

type Options = {
  deviceKey: string;
  enabled: boolean;
  onSignal: (signal: IncomingSignal) => void | Promise<void>;
};

/**
 * Consegna i segnali WebRTC in tempo reale. Il callback vive in una ref,
 * così i segnali usano sempre lo stato più recente del componente.
 */
export function useSignals({ deviceKey, enabled, onSignal }: Options) {
  const handlerRef = useRef(onSignal);
  const lastIdRef = useRef(0);

  useEffect(() => {
    handlerRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!enabled || !deviceKey) return;
    let cancelled = false;
    const seen = new Set<number>();

    const source = new EventSource(
      `/api/signals/stream?deviceKey=${encodeURIComponent(deviceKey)}&sinceId=${lastIdRef.current}`,
    );

    source.onmessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(event.data) as { type?: string; signal?: IncomingSignal };
        if (payload.type !== "signal" || !payload.signal) return;
        const signal = payload.signal;
        if (seen.has(signal.id)) return;
        seen.add(signal.id);
        if (signal.id > lastIdRef.current) lastIdRef.current = signal.id;
        void handlerRef.current(signal);
      } catch {
        // payload non valido: ignorato
      }
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [deviceKey, enabled]);
}
