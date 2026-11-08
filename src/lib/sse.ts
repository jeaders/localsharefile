// Helper per le risposte Server-Sent Events (una connessione persistente
// sostituisce il polling ogni 1,5-3 secondi).

const encoder = new TextEncoder();

export type SseSend = (payload: unknown) => void;

/**
 * Crea una risposta text/event-stream. `onStart` riceve `send` e deve
 * restituire una funzione di cleanup (unsubscribe, clearInterval...).
 */
export function createSseResponse(
  request: Request,
  onStart: (send: SseSend) => Promise<(() => void) | void> | (() => void) | void,
): Response {
  let cleanup: (() => void) | void;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    try {
      cleanup?.();
    } catch (error) {
      console.warn("[NODO] cleanup SSE fallito:", error);
    }
    try {
      controllerRef?.close();
    } catch {
      // già chiuso
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controllerRef = controller;

      const send: SseSend = (payload) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          close();
        }
      };

      const ping = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          close();
        }
      };

      heartbeat = setInterval(ping, 20_000);
      request.signal.addEventListener("abort", close);

      try {
        cleanup = await onStart(send);
      } catch (error) {
        console.warn("[NODO] errore setup SSE:", error);
        close();
      }
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
