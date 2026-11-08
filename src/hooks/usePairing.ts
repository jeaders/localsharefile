"use client";

import { useCallback, useEffect, useState } from "react";
import { saveToken, storedToken } from "@/lib/client/api";

export type PairingStatus = "checking" | "required" | "paired";

async function pairWith(token: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const response = await fetch("/api/pairing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: trimmed }),
    credentials: "same-origin",
  });
  if (!response.ok) return false;
  saveToken(trimmed);
  return true;
}

/**
 * Accoppiamento al server tramite token condiviso.
 * 1. token nell'URL (?token=...) → lo salva e pulisce l'indirizzo
 * 2. token già salvato → lo rivalida
 * 3. macchina del server (loopback) → accoppiamento automatico
 */
export function usePairing() {
  const [status, setStatus] = useState<PairingStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const fromUrl = url.searchParams.get("token");
        if (fromUrl) {
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
          if (await pairWith(fromUrl)) {
            if (!cancelled) setStatus("paired");
            return;
          }
          if (!cancelled) setError("Il token nel link non è valido.");
        }

        const saved = storedToken();
        if (saved && (await pairWith(saved))) {
          if (!cancelled) setStatus("paired");
          return;
        }

        const response = await fetch("/api/pairing", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await response.json()) as {
          paired?: boolean;
          localToken?: string | null;
        };
        if (cancelled) return;

        if (data.paired) {
          setStatus("paired");
          return;
        }
        if (data.localToken && (await pairWith(data.localToken))) {
          if (!cancelled) setStatus("paired");
          return;
        }
        setStatus("required");
      } catch {
        if (!cancelled) {
          setStatus("required");
          setError("Impossibile contattare il server.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (token: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      if (await pairWith(token)) {
        setStatus("paired");
        return true;
      }
      setError("Token non valido: controlla il valore mostrato dal server.");
      return false;
    } catch {
      setError("Errore di rete durante l'accoppiamento.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { status, error, submitting, submit };
}
