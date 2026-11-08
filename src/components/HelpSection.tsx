"use client";

import { CircleHelp, Copy } from "lucide-react";

type Props = {
  httpsUrl: string;
  httpUrl: string;
  currentOrigin: string;
  onShare: () => void;
};

export function HelpSection({ httpsUrl, httpUrl, currentOrigin, onShare }: Props) {
  return (
    <section className="page-section">
      <div className="section-page-heading">
        <div>
          <div className="eyebrow">
            <CircleHelp size={14} /> GUIDA TECNICA
          </div>
          <h1>Come Collegare Davvero i Tuoi Computer</h1>
          <p>IP locali, porte e connessione diretta tra computer fisici.</p>
        </div>
        <button className="primary-button" onClick={onShare}>
          <Copy size={16} /> Copia URL con token
        </button>
      </div>

      <div className="help-grid">
        <div className="help-card card">
          <div className="help-badge">Metodo 1: rete locale (consigliato)</div>
          <h3>Avvia NODO sul tuo PC di casa</h3>
          <p>I dati restano sul tuo computer e sul database che hai configurato:</p>
          <ol>
            <li>
              Installa le dipendenze: <code>npm install</code>
            </li>
            <li>
              Prepara il database: <code>npm run db:migrate</code>
            </li>
            <li>
              Avvia tutto (build, certificato HTTPS, proxy):
              <pre>npm run server</pre>
            </li>
            <li>
              Dagli altri PC apri l’indirizzo HTTPS mostrato dal server:
              <pre>{httpsUrl}</pre>
              <small>La condivisione schermo richiede HTTPS: accetta l’avviso del certificato.</small>
            </li>
            <li>
              Servizio HTTP locale, se ti serve solo lo scambio file:
              <pre>{httpUrl}</pre>
            </li>
          </ol>
        </div>

        <div className="help-card card">
          <div className="help-badge secondary">Metodo 2: accesso e sicurezza</div>
          <h3>Token condiviso e dispositivi</h3>
          <p>
            L’istanza che stai usando è <code>{currentOrigin}</code>. Ogni richiesta alle API
            richiede un token, così nessun altro nella rete può leggere o cancellare i tuoi file.
          </p>
          <ol>
            <li>
              Apri l’app sulla macchina del server: viene accoppiata da sola.
            </li>
            <li>
              Premi <b>Condividi URL</b>: il link copiato contiene il token e accoppia gli altri PC
              al primo accesso.
            </li>
            <li>
              Per revocare tutti gli accessi cancella <code>data/nodo-token</code> e riavvia il
              server.
            </li>
            <li>
              Il file <code>.env</code> e il certificato non vanno versionati: sono già in{" "}
              <code>.gitignore</code>.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
