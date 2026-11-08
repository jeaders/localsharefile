"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { ServerInfo } from "@/lib/client/types";

export function useServerInfo(enabled: boolean): ServerInfo | null {
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await apiFetch("/api/server-info", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as ServerInfo;
        if (!cancelled) setInfo(data);
      } catch (error) {
        console.warn("[NODO] server-info non disponibile:", error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return info;
}
