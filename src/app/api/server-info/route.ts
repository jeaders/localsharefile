import { networkInterfaces } from "os";

export const dynamic = "force-dynamic";

const HTTP_PORT = Number(process.env.NODO_HTTP_PORT ?? 3000);
const HTTPS_PORT = Number(process.env.NODO_HTTPS_PORT ?? 3443);

/** Informazioni di rete per costruire gli indirizzi di connessione. */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const localIps: { interface: string; address: string; isLinkLocal: boolean }[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (!list) continue;
    for (const info of list) {
      if ((info.family === "IPv4" || (info.family as unknown) === 4) && !info.internal) {
        localIps.push({
          interface: name,
          address: info.address,
          isLinkLocal: info.address.startsWith("169.254."),
        });
      }
    }
  }

  const isCloudSandbox = Boolean(
    process.env.E2B_SANDBOX || process.env.VERCEL || process.env.CODESPACES || process.env.SANDBOX_ID,
  );

  // Indirizzo HTTPS consigliato (necessario per la condivisione schermo),
  // ricavato dalle interfacce reali invece che da un IP cablato nel codice.
  const primaryIp = localIps.find((ip) => !ip.isLinkLocal)?.address ?? null;
  const httpsUrl = `https://${primaryIp ?? "localhost"}:${HTTPS_PORT}`;

  return Response.json({
    currentOrigin: url.origin,
    httpPort: HTTP_PORT,
    httpsPort: HTTPS_PORT,
    httpsUrl,
    primaryIp,
    localIps,
    isCloudSandbox,
  });
}
