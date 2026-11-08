#!/usr/bin/env bash
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/.server.pid"
PGID_FILE="$PROJECT_DIR/.server.pid.pgid"
LOG_FILE="$PROJECT_DIR/.server.log"
HTTP_PORT="${NODO_HTTP_PORT:-3000}"
HTTPS_PORT="${NODO_HTTPS_PORT:-3443}"
export NODO_HTTPS_URL="https://localhost:$HTTPS_PORT"

source "$PROJECT_DIR/nodo-env.sh"

INTERACTIVE=0
if [ -t 0 ] && [ -t 1 ]; then
    INTERACTIVE=1
fi

pause_on_exit() {
    if [ "$INTERACTIVE" = "1" ]; then
        echo ""
        echo "Premi Invio per chiudere..."
        read -r _ || true
    fi
}
trap pause_on_exit EXIT

# --- Server già attivo? ---
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "Server già attivo (PID: $PID)"
        echo "  HTTP:  http://localhost:$HTTP_PORT"
        echo "  HTTPS: https://localhost:$HTTPS_PORT"
        apri_browser "$NODO_HTTPS_URL"
        exit 0
    fi
    rm -f "$PID_FILE" "$PGID_FILE"
fi

# --- Node >= 20.9 ---
if ! nodo_setup_path; then
    echo "ERRORE: Node.js >= 20.9.0 non trovato."
    echo "Next.js 16 richiede Node 20.9 o superiore."
    echo "Node trovato: $(node --version 2>/dev/null || echo 'nessuno')"
    echo ""
    echo "Se usi nvm: source ~/.nvm/nvm.sh && nvm use 22"
    exit 1
fi

echo "Node: $(node --version) ($(command -v node))"
cd "$PROJECT_DIR" || exit 1

# --- Dipendenze ---
if [ ! -x "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
    echo "Dipendenze mancanti: eseguo npm install..."
    npm install || { echo "ERRORE: npm install non riuscito."; exit 1; }
fi

# --- Build di produzione ---
if [ ! -f "$PROJECT_DIR/.next/BUILD_ID" ]; then
    echo "Build di produzione assente: eseguo npm run build..."
    npm run build || { echo "ERRORE: build non riuscita."; exit 1; }
fi

# --- Certificato TLS ---
if [ ! -f "$PROJECT_DIR/localhost-cert.pem" ] || [ ! -f "$PROJECT_DIR/localhost-key.pem" ]; then
    echo "Certificato TLS assente: lo genero..."
    "$PROJECT_DIR/scripts/gen-cert.sh" || { echo "ERRORE: generazione certificato fallita."; exit 1; }
fi

echo "Avvio del server Next.js con proxy HTTPS..."

# setsid (Linux) crea una nuova sessione; su macOS non esiste, si usa nohup.
if command -v setsid >/dev/null 2>&1; then
    setsid "$PROJECT_DIR/node_modules/.bin/tsx" "$PROJECT_DIR/https-proxy.ts" >"$LOG_FILE" 2>&1 &
else
    nohup "$PROJECT_DIR/node_modules/.bin/tsx" "$PROJECT_DIR/https-proxy.ts" >"$LOG_FILE" 2>&1 &
fi
PARENT_PID=$!
echo "$PARENT_PID" >"$PID_FILE"
PGID=$(ps -o pgid= -p "$PARENT_PID" 2>/dev/null | tr -d ' ')
[ -n "$PGID" ] && echo "$PGID" >"$PGID_FILE"

echo "Attesa del server..."
for _ in $(seq 1 30); do
    if curl -s --max-time 1 "http://localhost:$HTTP_PORT/api/health" >/dev/null 2>&1; then
        echo ""
        echo "Server avviato (PID: $PARENT_PID)"
        echo "  HTTP:  http://localhost:$HTTP_PORT"
        echo "  HTTPS: https://localhost:$HTTPS_PORT"
        echo ""
        echo "Token di accesso: data/nodo-token"
        echo "Il primo dispositivo collegato via localhost viene accoppiato in automatico;"
        echo "per gli altri usa il pulsante 'Condividi URL' che include il token."
        apri_browser "$NODO_HTTPS_URL"
        exit 0
    fi
    if ! kill -0 "$PARENT_PID" 2>/dev/null; then
        echo ""
        echo "ERRORE: il processo del server è terminato. Log:"
        echo "-------------------------------------"
        cat "$LOG_FILE" 2>/dev/null
        echo "-------------------------------------"
        rm -f "$PID_FILE" "$PGID_FILE"
        exit 1
    fi
    sleep 1
done

echo ""
echo "ERRORE: il server non ha risposto entro 30 secondi. Log:"
echo "-------------------------------------"
cat "$LOG_FILE" 2>/dev/null
echo "-------------------------------------"
exit 1
