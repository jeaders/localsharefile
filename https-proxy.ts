import http from "node:http";
import https from "node:https";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const DEV = process.argv.includes("--dev");
const NEXT_PORT = Number(process.env.NODO_HTTP_PORT ?? 3000);
const PROXY_PORT = Number(process.env.NODO_HTTPS_PORT ?? 3443);
const NEXT_HOST = "127.0.0.1";
const PROXY_HOST = "0.0.0.0";

const CERT_FILE = join(process.cwd(), "localhost-cert.pem");
const KEY_FILE = join(process.cwd(), "localhost-key.pem");

function ensureCertificates(): void {
  if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) return;
  console.log("[NODO] Certificato TLS assente: lo genero ora...");
  const result = spawnSync("bash", [join(process.cwd(), "scripts", "gen-cert.sh")], {
    stdio: "inherit",
  });
  if (result.status !== 0 || !existsSync(CERT_FILE) || !existsSync(KEY_FILE)) {
    console.error("[NODO] Generazione fallita. Rilancia manualmente: npm run cert");
    process.exit(1);
  }
}

function normalizeIp(value: string | undefined): string {
  if (!value) return "unknown";
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

function startNext(): void {
  const args = DEV
    ? ["./node_modules/next/dist/bin/next", "dev", "-H", NEXT_HOST, "-p", String(NEXT_PORT)]
    : ["./node_modules/next/dist/bin/next", "start", "-H", NEXT_HOST, "-p", String(NEXT_PORT)];

  const child = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env } });

  const shutdown = () => {
    child.kill("SIGTERM");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[NODO] Next.js terminato con codice ${code}`);
    }
    process.exit(code ?? 0);
  });
}

ensureCertificates();

const options = {
  key: readFileSync(KEY_FILE),
  cert: readFileSync(CERT_FILE),
};

const proxy = https.createServer(options, (req, res) => {
  // X-Forwarded-For è impostato da noi: il server può fidarsi perché l'unica
  // via d'ingresso è questo proxy (Next ascolta solo su 127.0.0.1).
  const headers: http.OutgoingHttpHeaders = {
    ...req.headers,
    host: `${NEXT_HOST}:${NEXT_PORT}`,
    "x-forwarded-for": normalizeIp(req.socket.remoteAddress),
    "x-forwarded-proto": "https",
    "x-forwarded-host": req.headers.host ?? "",
  };

  const proxyReq = http.request(
    {
      hostname: NEXT_HOST,
      port: NEXT_PORT,
      path: req.url ?? "/",
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (error) => {
    console.error("[NODO] proxy error:", error.message);
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Il server HTTP non è ancora pronto. Riprova tra qualche secondo.");
  });

  req.pipe(proxyReq);
});

// Il traffico WebSocket (hot reload in sviluppo) viaggia in tunnel diretto.
proxy.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(NEXT_PORT, NEXT_HOST, () => {
    const headerLines = Object.entries(req.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(", ") : value}`)
      .join("\r\n");
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

proxy.listen(PROXY_PORT, PROXY_HOST, () => {
  const urls = Object.entries(os.networkInterfaces())
    .flatMap(([, list]) => list ?? [])
    .filter((info) => info.family === "IPv4" || (info.family as unknown) === 4)
    .filter((info) => !info.internal)
    .map((info) => `https://${info.address}:${PROXY_PORT}`);

  console.log(`[NODO] Proxy HTTPS su porta ${PROXY_PORT} (modalità ${DEV ? "sviluppo" : "produzione"})`);
  console.log("[NODO] Apri uno di questi indirizzi dagli altri dispositivi:");
  for (const url of urls) console.log("  -", url);
  console.log("[NODO] La prima volta accetta l'avviso sul certificato self-signed.");
});

startNext();
