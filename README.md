# NODO

Condivisione file e controllo remoto tra i computer della stessa rete.
Next.js 16 + PostgreSQL (Drizzle) + WebRTC.

## Requisiti

- Node.js >= 20.9
- Un database PostgreSQL (Neon, Supabase o locale)

## Installazione

```bash
npm install
cp .env.example .env     # inserisci DATABASE_URL
npm run db:migrate       # crea tabelle e indici, sposta i vecchi blob su disco
```

## Avvio

```bash
npm run server           # build se serve, certificato TLS, proxy HTTPS, apre il browser
npm run server:stop      # arresta il server avviato da npm run server
```

In sviluppo:

```bash
npm run dev              # http://localhost:3000
npm run dev:https        # proxy HTTPS su https://localhost:3443 (serve per la condivisione schermo)
```

La condivisione schermo (`getDisplayMedia`) richiede un contesto sicuro: usa l'URL HTTPS.

## Accesso e token

Tutte le API che leggono o modificano dati richiedono un token condiviso:

- il token viene generato al primo avvio in `data/nodo-token` (permessi `600`), oppure
  lo puoi fissare con `NODO_TOKEN` nel `.env`;
- aprendo l'app **sulla macchina che esegue il server** l'accoppiamento è automatico;
- per gli altri computer usa il pulsante **Condividi URL**: il link copiato contiene
  il token (`https://192.168.x.x:3443/?token=...`) e li accoppia al primo accesso.

Per revocare tutti gli accessi: cancella `data/nodo-token` (o cambia `NODO_TOKEN`)
e riavvia il server; poi riaccoppia i dispositivi.

## File

I contenuti dei file stanno su disco in `data/uploads/`; il database contiene solo
i metadati (`files`). I download usano lo streaming (`/api/files/:id`), l'eliminazione
rimuove anche il file dal disco. Il limite di upload è `NODO_MAX_UPLOAD_MB` (default 2048).

## Realtime

Niente polling: un solo stream SSE (`/api/events`) aggiorna dispositivi e file, e
`/api/signals/stream` consegna i segnali WebRTC. I segnali non consegnati scadono
dopo 15 minuti; i dispositivi inattivi da 30 giorni vengono rimossi.

## Helper per mouse/tastiera reali

Vedi [helper/README.md](helper/README.md). L'helper accetta richieste solo da origini
locali/private e richiede il token dell'app.

## Variabili d'ambiente

Vedi [.env.example](.env.example): `DATABASE_URL`, `NODO_TOKEN`, `NODO_HTTP_PORT`,
`NODO_HTTPS_PORT`, `NODO_ALLOWED_ORIGINS`, `NODO_MAX_UPLOAD_MB`,
`DATABASE_SSL_REJECT_UNAUTHORIZED`.

## Script

| Comando | Cosa fa |
|---|---|
| `npm run dev` | dev server HTTP |
| `npm run dev:https` | dev server dietro proxy HTTPS |
| `npm run build` | build di produzione |
| `npm run server` | avvio completo (build + HTTPS + browser) |
| `npm run server:stop` | arresto |
| `npm run db:migrate` | schema, indici, migrazione blob su disco (idempotente, sicuro sul DB esistente) |
| `npm run db:generate` | genera una nuova migrazione SQL in `drizzle/` dal file di schema |
| `npm run cert` | rigenera il certificato TLS con gli IP correnti |
| `npm run helper` | avvia l'helper input nativo |
| `npm run lint` / `npm run typecheck` | controlli |
