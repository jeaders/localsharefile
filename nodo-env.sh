#!/usr/bin/env bash
# Utility condivise dagli script di avvio/arresto.
# Cerca un eseguibile "node" con versione >= 20.9.0 (richiesto da Next.js 16).

NODO_MIN_MAJOR=20
NODO_MIN_MINOR=9

nodo_version_ok() {
    local bin="$1" ver major minor
    [ -x "$bin" ] || return 1
    ver="$("$bin" --version 2>/dev/null)" || return 1
    ver="${ver#v}"
    [ -n "$ver" ] || return 1
    major="${ver%%.*}"
    minor="${ver#*.}"
    minor="${minor%%.*}"
    case "$major$minor" in
        ''|*[!0-9]*) return 1 ;;
    esac
    [ "$major" -gt "$NODO_MIN_MAJOR" ] && return 0
    [ "$major" -eq "$NODO_MIN_MAJOR" ] && [ "$minor" -ge "$NODO_MIN_MINOR" ] && return 0
    return 1
}

nodo_find() {
    local candidate best="" best_ver="" ver major minor best_major best_minor
    for candidate in \
        "$HOME"/.nvm/versions/node/*/bin/node \
        "$HOME"/.local/share/mise/installs/node/*/bin/node \
        /opt/homebrew/bin/node \
        /usr/local/bin/node \
        /usr/bin/node \
        /snap/bin/node \
        "$(command -v node 2>/dev/null || true)"
    do
        [ -x "$candidate" ] || continue
        nodo_version_ok "$candidate" || continue
        ver="$("$candidate" --version 2>/dev/null)"
        ver="${ver#v}"
        major="${ver%%.*}"
        minor="${ver#*.}"
        minor="${minor%%.*}"
        if [ -z "$best_ver" ]; then
            best="$candidate"; best_ver="$ver"; best_major="$major"; best_minor="$minor"
            continue
        fi
        if [ "$major" -gt "$best_major" ] || \
           { [ "$major" -eq "$best_major" ] && [ "$minor" -gt "$best_minor" ]; }; then
            best="$candidate"; best_ver="$ver"; best_major="$major"; best_minor="$minor"
        fi
    done
    [ -n "$best" ] && echo "$best"
}

nodo_setup_path() {
    local node_bin
    node_bin="$(nodo_find)" || return 1
    PATH="$(dirname "$node_bin"):$PATH"
    export PATH
    export NODO_NODE="$node_bin"
    return 0
}

# Apre il browser di sistema. Funziona su macOS e Linux, senza bloccare.
apri_browser() {
    local url="${1:-${NODO_HTTPS_URL:-https://localhost:3443}}"

    case "$(uname -s)" in
        Darwin)
            if [ -d "/Applications/Google Chrome.app" ]; then
                open -na "Google Chrome" --args --new-window "$url" >/dev/null 2>&1 && return 0
            fi
            if [ -d "/Applications/Chromium.app" ]; then
                open -na "Chromium" --args --new-window "$url" >/dev/null 2>&1 && return 0
            fi
            if command -v open >/dev/null 2>&1; then
                open "$url" >/dev/null 2>&1 && return 0
            fi
            ;;
        *)
            local candidate
            for candidate in google-chrome-stable google-chrome chromium chromium-browser chrome; do
                if command -v "$candidate" >/dev/null 2>&1; then
                    "$candidate" --new-tab "$url" >/dev/null 2>&1 &
                    disown 2>/dev/null || true
                    return 0
                fi
            done
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "$url" >/dev/null 2>&1 &
                disown 2>/dev/null || true
                return 0
            fi
            ;;
    esac

    echo "Browser non trovato: apri manualmente $url"
    return 1
}

# Alias storico usato da versioni precedenti degli script.
apri_chrome() { apri_browser "$@"; }
