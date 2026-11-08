import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { signals } from "@/db/schema";
import { publishSignal } from "@/lib/bus";
import { and, eq, gt, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["offer", "answer", "candidate", "cmd"]);
const MAX_PAYLOAD_LENGTH = 64 * 1024;
const MAX_DELETE_IDS = 200;

function isValidDeviceKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 100;
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Invio segnale (offerta, risposta, candidato ICE, o comando remoto) */
export async function POST(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      fromDeviceKey?: unknown;
      toDeviceKey?: unknown;
      type?: unknown;
      payload?: unknown;
    };

    const { fromDeviceKey, toDeviceKey, type } = body;
    if (!isValidDeviceKey(fromDeviceKey) || !isValidDeviceKey(toDeviceKey)) {
      return Response.json({ error: "deviceKey non valido" }, { status: 400 });
    }
    if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) {
      return Response.json({ error: "Tipo di segnale non ammesso" }, { status: 400 });
    }

    const payloadText =
      typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload ?? {});
    if (payloadText.length > MAX_PAYLOAD_LENGTH) {
      return Response.json({ error: "Payload troppo grande" }, { status: 413 });
    }

    // I comandi remoti possono aprire un URL: solo http/https.
    if (type === "cmd") {
      let parsed: { action?: unknown; url?: unknown } = {};
      try {
        parsed = JSON.parse(payloadText) as { action?: unknown; url?: unknown };
      } catch {
        return Response.json({ error: "Payload del comando non valido" }, { status: 400 });
      }
      if (parsed.action === "openUrl" && !isHttpUrl(parsed.url)) {
        return Response.json(
          { error: "Sono ammessi solo URL http/https" },
          { status: 400 },
        );
      }
    }

    const [created] = await db
      .insert(signals)
      .values({ fromDeviceKey, toDeviceKey, type, payload: payloadText })
      .returning();

    publishSignal(created);

    return Response.json({ ok: true, signal: created });
  } catch (error) {
    console.error("Errore salvataggio segnale:", error);
    return Response.json({ error: "Errore segnale" }, { status: 500 });
  }
}

/** Fallback di lettura (lo stream SSE è la via principale). */
export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const toDeviceKey = url.searchParams.get("toDeviceKey");
    const sinceId = Number.parseInt(url.searchParams.get("sinceId") || "0", 10);

    if (!isValidDeviceKey(toDeviceKey)) {
      return Response.json({ error: "toDeviceKey non valido" }, { status: 400 });
    }

    const unread = await db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.toDeviceKey, toDeviceKey),
          gt(signals.id, Number.isFinite(sinceId) ? sinceId : 0),
        ),
      )
      .orderBy(signals.id);

    return Response.json({ signals: unread });
  } catch (error) {
    console.error("Errore fetch segnali:", error);
    return Response.json({ signals: [], error: "Errore segnali" }, { status: 500 });
  }
}

/** Eliminazione dei segnali già gestiti. */
export async function DELETE(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (ids.length === 0 || ids.length > MAX_DELETE_IDS) {
      return Response.json({ error: "ids mancanti o troppo numerosi" }, { status: 400 });
    }

    await db.delete(signals).where(inArray(signals.id, ids));
    return Response.json({ ok: true, deleted: ids.length });
  } catch (error) {
    console.error("Errore eliminazione segnali:", error);
    return Response.json({ error: "Errore eliminazione" }, { status: 500 });
  }
}
