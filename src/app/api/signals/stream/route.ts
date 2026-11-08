import { and, eq, gt, gte } from "drizzle-orm";
import { db } from "@/db";
import { signals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { subscribeSignals } from "@/lib/bus";
import { createSseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";

// Al primo collegamento rigiochiamo solo i segnali recenti: una vecchia
// offerta non deve far ripartire una connessione mai richiesta.
const REPLAY_WINDOW_MS = 2 * 60_000;

/** Stream dei segnali WebRTC destinati a questo dispositivo. */
export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const deviceKey = url.searchParams.get("deviceKey") ?? "";
  const sinceId = Number.parseInt(url.searchParams.get("sinceId") ?? "0", 10);

  if (deviceKey.length < 8 || deviceKey.length > 100) {
    return Response.json({ error: "deviceKey non valido" }, { status: 400 });
  }

  const afterId = Number.isFinite(sinceId) && sinceId > 0 ? sinceId : 0;

  return createSseResponse(request, async (send) => {
    const pending = await db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.toDeviceKey, deviceKey),
          gt(signals.id, afterId),
          gte(signals.createdAt, new Date(Date.now() - REPLAY_WINDOW_MS)),
        ),
      )
      .orderBy(signals.id);

    for (const signal of pending) {
      send({ type: "signal", signal });
    }

    const unsubscribe = subscribeSignals((signal) => {
      if (signal.toDeviceKey !== deviceKey) return;
      if (signal.id <= afterId) return;
      send({ type: "signal", signal });
    });

    return () => unsubscribe();
  });
}
