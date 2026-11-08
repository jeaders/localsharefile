"use client";

import { AlertTriangle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

type Props = {
  error: string | null;
  submitting: boolean;
  onSubmit: (token: string) => Promise<boolean>;
};

export function PairingGate({ error, submitting, onSubmit }: Props) {
  const [token, setToken] = useState("");

  return (
    <div className="pairing-shell">
      <form
        className="pairing-card"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(token);
        }}
      >
        <div className="pairing-mark">
          <ShieldCheck size={26} />
        </div>
        <h1>Accoppia questo dispositivo</h1>
        <p>
          NODO accetta solo dispositivi autorizzati. Incolla il token di accesso mostrato dal
          server, oppure apri il link condiviso che lo contiene già.
        </p>

        <label className="pairing-label" htmlFor="nodo-token">
          <KeyRound size={14} /> Token di accesso
        </label>
        <input
          id="nodo-token"
          className="pairing-input"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Incolla qui il token"
          autoComplete="off"
          spellCheck={false}
        />

        {error && (
          <div className="pairing-error">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button className="primary-button" type="submit" disabled={submitting || !token.trim()}>
          {submitting ? <Loader2 size={15} /> : <ShieldCheck size={15} />}
          {submitting ? "Verifica..." : "Accoppia"}
        </button>

        <small className="pairing-hint">
          Il token viene generato al primo avvio in <code>data/nodo-token</code> (o
          impostato con <code>NODO_TOKEN</code>).
        </small>
      </form>
    </div>
  );
}
