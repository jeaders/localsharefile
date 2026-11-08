import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const TOKEN_FILE = join(DATA_DIR, "nodo-token");
const COOKIE_NAME = "nodo_token";
const MIN_TOKEN_LENGTH = 16;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

let cachedToken: string | null = null;

function createToken(): string {
  const token = randomBytes(24).toString("base64url");
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
    console.log(`[NODO] Nuovo token di accesso salvato in ${TOKEN_FILE}`);
  } catch (error) {
    console.warn("[NODO] Impossibile salvare il token su disco:", error);
  }
  return token;
}

/**
 * Token condiviso dell'istanza. Ordine di precedenza:
 * 1. NODO_TOKEN dall'ambiente
 * 2. data/nodo-token (generato al primo avvio)
 */
export function getAppToken(): string {
  if (cachedToken) return cachedToken;

  const fromEnv = process.env.NODO_TOKEN?.trim();
  if (fromEnv && fromEnv.length >= MIN_TOKEN_LENGTH) {
    cachedToken = fromEnv;
    return cachedToken;
  }

  try {
    if (existsSync(TOKEN_FILE)) {
      const stored = readFileSync(TOKEN_FILE, "utf8").trim();
      if (stored.length >= MIN_TOKEN_LENGTH) {
        cachedToken = stored;
        return stored;
      }
    }
  } catch (error) {
    console.warn("[NODO] Impossibile leggere il token salvato:", error);
  }

  cachedToken = createToken();
  return cachedToken;
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyToken(token: string): boolean {
  if (!token) return false;
  return safeEqual(token, getAppToken());
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function tokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  const header = request.headers.get("x-nodo-token");
  if (header) return header.trim();
  return readCookie(request, COOKIE_NAME);
}

export function isAuthorized(request: Request): boolean {
  const token = tokenFromRequest(request);
  return Boolean(token) && verifyToken(token as string);
}

export function unauthorized(): Response {
  return Response.json(
    { error: "Token di accesso mancante o non valido", code: "unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

/** Restituisce una risposta 401 se la richiesta non è autorizzata, altrimenti null. */
export function requireAuth(request: Request): Response | null {
  return isAuthorized(request) ? null : unauthorized();
}

/**
 * Vero solo se la richiesta arriva dalla macchina che esegue il server.
 * Il proxy HTTPS aggiunge sempre X-Forwarded-For; l'accesso diretto viene
 * accettato solo quando l'host richiesto è un loopback.
 */
export function isLoopbackRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = (forwarded.split(",")[0] ?? "").trim();
    if (!first) return false;
    if (first === "::1" || first === "::ffff:127.0.0.1") return true;
    return /^127\./.test(first);
  }
  const host = request.headers.get("host") ?? "";
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

export function authCookie(token: string, request: Request): string {
  const secure = request.headers.get("x-forwarded-proto") === "https";
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
