import { eq } from "drizzle-orm";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { publishDevicesChanged } from "@/lib/bus";
import { cleanText } from "@/lib/devices";
import { listDevices } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Lista condivisa di tutti i dispositivi registrati nella rete. */
export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    return Response.json({ devices: await listDevices() });
  } catch (error) {
    console.error("[API/devices] GET error:", error);
    return Response.json(
      { devices: [], error: "Impossibile leggere i dispositivi" },
      { status: 500 },
    );
  }
}

/** Rinomina un dispositivo. */
export async function PATCH(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as { id?: unknown; name?: unknown };
    const id = Number(payload.id);
    const name = cleanText(payload.name, "", 60);
    if (!Number.isInteger(id) || !name) {
      return Response.json({ error: "id e name sono obbligatori" }, { status: 400 });
    }

    const [device] = await db.update(devices).set({ name }).where(eq(devices.id, id)).returning();
    if (!device) return Response.json({ error: "Dispositivo non trovato" }, { status: 404 });

    publishDevicesChanged("devices");
    return Response.json({ device });
  } catch {
    return Response.json({ error: "Impossibile rinominare il dispositivo" }, { status: 500 });
  }
}

/** Rimuove un dispositivo dal registro (tornerà se il browser si ricollega). */
export async function DELETE(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = Number(payload.id);
    if (!Number.isInteger(id)) return Response.json({ error: "id obbligatorio" }, { status: 400 });

    await db.delete(devices).where(eq(devices.id, id));
    publishDevicesChanged("devices");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Impossibile rimuovere il dispositivo" }, { status: 500 });
  }
}
