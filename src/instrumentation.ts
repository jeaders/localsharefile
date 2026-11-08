// Avviato una volta dal server Next: timer di pulizia e aggiornamento stato.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureMaintenance } = await import("./lib/maintenance");
    ensureMaintenance();
  } catch (error) {
    console.warn("[NODO] Manutenzione non avviata:", error);
  }
}
