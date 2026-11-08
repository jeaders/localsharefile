"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { ApiDevice, SharedFile } from "@/lib/client/types";

type Snapshot = {
  type?: string;
  devices?: ApiDevice[];
  files?: SharedFile[];
};

/**
 * Un solo stream SSE per dispositivi e file: i cambiamenti arrivano
 * appena avvengono invece di essere interrogati ogni 3 secondi.
 */
export function useSharedState(enabled: boolean) {
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const source = new EventSource("/api/events");

    source.onopen = () => {
      if (cancelled) return;
      setConnected(true);
      setStreamError(null);
    };

    source.onmessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(event.data) as Snapshot;
        if (payload.type !== "snapshot") return;
        setDevices(payload.devices ?? []);
        setFiles(payload.files ?? []);
        setConnected(true);
      } catch {
        // messaggio non valido: ignorato
      }
    };

    source.onerror = () => {
      if (cancelled) return;
      setConnected(false);
      setStreamError("Connessione al server persa: riprovo automaticamente.");
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [enabled]);

  /** Ricarica manuale (usata dopo un'operazione critica). */
  const refresh = useCallback(async () => {
    try {
      const [deviceResponse, fileResponse] = await Promise.all([
        apiFetch("/api/devices", { cache: "no-store" }),
        apiFetch("/api/files", { cache: "no-store" }),
      ]);
      if (deviceResponse.ok) {
        const data = (await deviceResponse.json()) as { devices?: ApiDevice[] };
        setDevices(data.devices ?? []);
      }
      if (fileResponse.ok) {
        const data = (await fileResponse.json()) as { files?: SharedFile[] };
        setFiles(data.files ?? []);
      }
    } catch (error) {
      console.warn("[NODO] refresh non riuscito:", error);
    }
  }, []);

  return { devices, files, connected, streamError, refresh };
}
