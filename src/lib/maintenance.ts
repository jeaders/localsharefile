import { lt } from "drizzle-orm";
import { db } from "@/db";
import { devices, signals } from "@/db/schema";
import { publishDevicesChanged } from "@/lib/bus";

// I segnali WebRTC non consegnati scadono: servono solo nella finestra di handshake.
const SIGNAL_TTL_MS = 15 * 60_000;
// Un dispositivo che non si fa vivo da un mese viene rimosso dal registro.
const DEVICE_TTL_MS = 30 * 24 * 60 * 60_000;
const SWEEP_INTERVAL_MS = 60 * 60_000;
const TICK_INTERVAL_MS = 15_000;

export async function cleanupStaleData(): Promise<void> {
  const now = Date.now();
  try {
    const removedSignals = await db
      .delete(signals)
      .where(lt(signals.createdAt, new Date(now - SIGNAL_TTL_MS)))
      .returning({ id: signals.id });
    const removedDevices = await db
      .delete(devices)
      .where(lt(devices.lastSeenAt, new Date(now - DEVICE_TTL_MS)))
      .returning({ id: devices.id });

    if (removedSignals.length > 0 || removedDevices.length > 0) {
      console.log(
        `[NODO] Pulizia: ${removedSignals.length} segnali scaduti, ${removedDevices.length} dispositivi inattivi rimossi`,
      );
      publishDevicesChanged("cleanup");
    }
  } catch (error) {
    console.warn("[NODO] Pulizia dati non riuscita:", error);
  }
}

/**
 * Avvia i timer di manutenzione una sola volta per processo:
 * pulizia oraria e aggiornamento periodico dello stato online/inattivo.
 */
export function ensureMaintenance(): void {
  const globalForMaintenance = globalThis as typeof globalThis & {
    __nodoMaintenance?: { sweep: ReturnType<typeof setInterval>; tick: ReturnType<typeof setInterval> };
  };
  if (globalForMaintenance.__nodoMaintenance) return;

  const sweep = setInterval(() => {
    void cleanupStaleData();
  }, SWEEP_INTERVAL_MS);
  const tick = setInterval(() => {
    publishDevicesChanged("tick");
  }, TICK_INTERVAL_MS);

  sweep.unref?.();
  tick.unref?.();

  globalForMaintenance.__nodoMaintenance = { sweep, tick };
  void cleanupStaleData();
}
