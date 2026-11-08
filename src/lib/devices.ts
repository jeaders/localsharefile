// Helpers condivisi lato server per il registro dispositivi.

export type DeviceStatus = "online" | "idle" | "offline";

// Un dispositivo è "online" se ha inviato un heartbeat negli ultimi 45 secondi,
// "inattivo" se negli ultimi 10 minuti, altrimenti "offline".
export function getDeviceStatus(lastSeenAt: Date, now: number = Date.now()): DeviceStatus {
  const age = now - lastSeenAt.getTime();
  if (age <= 45_000) return "online";
  if (age <= 10 * 60_000) return "idle";
  return "offline";
}

export function cleanText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

export function isIpv4(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  return value.split(".").every((part) => Number(part) <= 255);
}
