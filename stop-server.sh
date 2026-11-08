#!/usr/bin/env bash
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/.server.pid"
PGID_FILE="$PROJECT_DIR/.server.pid.pgid"
HTTP_PORT="${NODO_HTTP_PORT:-3000}"
HTTPS_PORT="${NODO_HTTPS_PORT:-3443}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

INTERACTIVE=0
if [ -t 0 ] && [ -t 1 ]; then
    INTERACTIVE=1
fi

if [ "$INTERACTIVE" = "1" ]; then
    trap 'echo ""; echo "Premi Invio per chiudere..."; read -r _ || true' EXIT
fi

stop_pid() {
    local pid="$1" pgid="$2" i
    if [ -n "$pgid" ]; then
        kill -- -"$pgid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    else
        kill "$pid" 2>/dev/null || true
    fi

    for i in $(seq 1 10); do
        kill -0 "$pid" 2>/dev/null || return 0
        sleep 0.5
    done

    echo "Forzatura dell'arresto..."
    if [ -n "$pgid" ]; then
        kill -9 -- -"$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    else
        kill -9 "$pid" 2>/dev/null || true
    fi
}

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    PGID=""
    [ -f "$PGID_FILE" ] && PGID=$(cat "$PGID_FILE" 2>/dev/null || echo "")

    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "Arresto del server (PID: $PID)..."
        stop_pid "$PID" "$PGID"
        echo "Server arrestato."
    else
        echo "Nessun server in esecuzione (file PID obsoleto)."
    fi
    rm -f "$PID_FILE" "$PGID_FILE"
else
    echo "Nessun file PID trovato."
fi

sleep 0.5

if curl -s --max-time 1 "http://localhost:$HTTP_PORT/api/health" >/dev/null 2>&1; then
    if [ "$FORCE" = "1" ] && command -v lsof >/dev/null 2>&1; then
        # Solo le porte di NODO, e solo su richiesta esplicita (--force).
        PIDS=$(lsof -ti "tcp:$HTTP_PORT" "tcp:$HTTPS_PORT" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "Arresto dei processi rimasti sulle porte $HTTP_PORT/$HTTPS_PORT: $PIDS"
            # shellcheck disable=SC2086
            kill $PIDS 2>/dev/null || true
            sleep 0.5
        fi
    else
        echo "ATTENZIONE: qualcosa risponde ancora sulla porta $HTTP_PORT."
        echo "Se sei sicuro che sia NODO, rilancia con: npm run server:stop -- --force"
        exit 1
    fi
fi

if curl -s --max-time 1 "http://localhost:$HTTP_PORT/api/health" >/dev/null 2>&1; then
    echo "ATTENZIONE: la porta $HTTP_PORT è ancora occupata."
    exit 1
fi

echo "Tutto fermo."
exit 0
