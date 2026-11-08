import {
  authCookie,
  clearAuthCookie,
  getAppToken,
  isAuthorized,
  isLoopbackRequest,
  verifyToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET: dice se il client è già accoppiato. Se la richiesta arriva dalla
 * macchina che esegue il server, restituisce anche il token per il primo
 * accesso (solo loopback, mai dalla rete).
 */
export async function GET(request: Request) {
  const paired = isAuthorized(request);
  const localToken = paired || !isLoopbackRequest(request) ? null : getAppToken();

  return Response.json(
    { paired, tokenRequired: true, localToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST { token }: verifica il token e imposta il cookie di sessione. */
export async function POST(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    token = "";
  }

  if (!verifyToken(token)) {
    return Response.json(
      { error: "Token non valido. Controlla il valore mostrato dal server." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": authCookie(token, request),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** DELETE: rimuove il cookie di sessione da questo browser. */
export async function DELETE() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearAuthCookie(), "Cache-Control": "no-store" } },
  );
}
