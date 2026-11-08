import { requireAuth } from "@/lib/auth";
import { subscribeDevices } from "@/lib/bus";
import { listDevices, listFiles } from "@/lib/queries";
import { createSseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";

/**
 * Stream unico per lo stato condiviso: dispositivi + file.
 * Sostituisce i due polling da 3 secondi con una sola connessione SSE.
 */
export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  return createSseResponse(request, (send) => {
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const push = async () => {
      if (running) return;
      running = true;
      try {
        const [deviceRows, fileRows] = await Promise.all([listDevices(), listFiles()]);
        send({ type: "snapshot", devices: deviceRows, files: fileRows });
      } catch (error) {
        console.warn("[NODO] snapshot SSE non riuscito:", error);
      } finally {
        running = false;
      }
    };

    // Debounce: molti eventi ravvicinati (heartbeat di più dispositivi)
    // producono un solo aggiornamento.
    const schedule = () => {
      if (scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = null;
        void push();
      }, 400);
    };

    void push();
    const unsubscribe = subscribeDevices(schedule);
    // Tick periodico: aggiorna le transizioni online -> inattivo -> offline
    // anche quando nessun dispositivo invia heartbeat.
    const tick = setInterval(schedule, 15_000);

    return () => {
      unsubscribe();
      clearInterval(tick);
      if (scheduled) clearTimeout(scheduled);
    };
  });
}
