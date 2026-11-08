#!/usr/bin/env bash
# Genera (o rigenera) il certificato self-signed usato dal proxy HTTPS.
# Include gli IP reali della macchina: niente IP cablati nel repository.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_FILE="$ROOT_DIR/localhost-cert.pem"
KEY_FILE="$ROOT_DIR/localhost-key.pem"

collect_ips() {
    local ips=""
    case "$(uname -s)" in
        Darwin)
            ips="$(ifconfig 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127\.' || true)"
            ;;
        *)
            ips="$(ip -4 -o addr show scope global 2>/dev/null | awk '{split($4,a,"/"); print a[1]}' || true)"
            if [ -z "$ips" ]; then
                ips="$(hostname -I 2>/dev/null || true)"
            fi
            ;;
    esac
    printf '%s\n' $ips
}

SAN="DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:::1"
while IFS= read -r ip; do
    [ -z "$ip" ] && continue
    SAN="$SAN,IP:$ip"
done < <(collect_ips | sort -u)

CONF_FILE="$(mktemp)"
trap 'rm -f "$CONF_FILE"' EXIT

cat >"$CONF_FILE" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_req
prompt = no

[dn]
CN = localhost

[v3_req]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $SAN
EOF

openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 397 \
    -config "$CONF_FILE" -keyout "$KEY_FILE" -out "$CERT_FILE" 2>/dev/null

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "Certificato creato:"
echo "  $CERT_FILE"
echo "  $KEY_FILE"
echo "SAN: $SAN"
