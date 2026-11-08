"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Errore nell’applicazione</h1>
      <pre style={{ background: "#fee2e2", padding: 12, borderRadius: 8 }}>
        {error.message}
      </pre>
      <button
        onClick={() => reset()}
        style={{ marginTop: 16, padding: "8px 16px" }}
      >
        Riprova
      </button>
    </div>
  );
}
