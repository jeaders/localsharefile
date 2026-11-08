import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __nodoPool?: Pool;
};

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

const poolConfig = (() => {
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const wantsSsl = !isLocalHost(host) || url.searchParams.get("sslmode") === "require";
  // La verifica del certificato resta attiva salvo esplicita rinuncia.
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  return {
    host,
    port: Number.parseInt(url.port || "5432", 10),
    database: decodeURIComponent(url.pathname.slice(1)),
    // Le credenziali nell'URL sono percent-encoded: vanno decodificate.
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: wantsSsl ? { rejectUnauthorized } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    application_name: "nodo",
  };
})();

export const pool = globalForDb.__nodoPool ?? new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nodoPool = pool;
}

export const db = drizzle(pool);
