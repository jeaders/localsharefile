# NODO Input Helper

Piccolo programma che gira **sul PC che condivide lo schermo** e permette di
muovere il **vero mouse** e usare la **vera tastiera** di sistema da remoto.

Il browser da solo NON può farlo (restrizione di sicurezza). Questo helper riceve
gli stessi eventi via WebRTC e li inietta a livello di sistema operativo.

## Sicurezza

L'helper può controllare l'intera macchina, quindi:

- accetta richieste **solo da origini locali/private** (`localhost`, `127.0.0.1`,
  `10.x`, `192.168.x`, `172.16-31.x`); qualsiasi altro sito viene rifiutato con 403;
- richiede il **token condiviso** di NODO nell'header `X-Nodo-Token`, letto da
  `data/nodo-token` (o da `NODO_TOKEN`). Senza token risponde 401.

Avvia quindi prima il server NODO almeno una volta: crea `data/nodo-token`.

## Installazione (una volta sola)

```bash
npm run helper:install
```

## Permesso obbligatorio su macOS

Senza questo passaggio l'helper parte ma il mouse NON si muove.

1. Apri **Impostazioni di Sistema > Privacy e sicurezza > Accessibilità**
2. Clicca il lucchetto e sblocca
3. Aggiungi (o abilita) l'app da cui lanci l'helper:
   - **Terminale** se lanci con `npm run helper`
   - **iTerm / Warp / VS Code** se usi quelli
4. Riavvia l'helper

Per verificare: `curl http://127.0.0.1:8899/health` deve rispondere `{"ok":true,...}`
(l'header `Origin` non serve a curl, ma serve al browser).

## Avvio

Va avviato **prima** di condividere lo schermo, sul PC che condivide:

```bash
npm run helper
```

Output atteso:

```
[NODO-HELPER] Schermo rilevato: 1920x1080
[NODO-HELPER] In ascolto su http://127.0.0.1:8899
[NODO-HELPER] Input di sistema REALE attivo.
```

## Come funziona

| Componente | Ruolo |
|---|---|
| Browser (chi guarda) | cattura mouse/tastiera e li invia via WebRTC data channel |
| `input-agent.mjs` | ascolta su `127.0.0.1:8899` e inietta eventi reali con `@nut-tree-fork/nut-js` |
| Browser (chi condivide) | inoltra i payload all'helper; se l'helper non c'è ripiega sugli eventi della pagina |

Le coordinate arrivano normalizzate `0..1` e vengono convertite con la
risoluzione reale dello schermo, quindi funzionano su qualsiasi monitor.

Se l'helper non è attivo, l'app mostra un avviso e continua a funzionare
ma solo all'interno della pagina condivisa.

## Windows / Linux

Stessa procedura. Su Windows l'iniezione funziona senza permessi particolari.
Su Linux serve `xdotool` o l'accesso a X11/Wayland.
