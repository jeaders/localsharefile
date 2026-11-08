import { db } from "@/db";
import { devices } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { publishDevicesChanged } from "@/lib/bus";
import { cleanText, isIpv4 } from "@/lib/devices";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as {
      deviceKey?: unknown;
      name?: unknown;
      kind?: unknown;
      platform?: unknown;
      browser?: unknown;
      address?: unknown;
      localIp?: unknown;
      macAddress?: unknown;
      userAgent?: unknown;
      screenSharing?: unknown;
    };

    const deviceKey = typeof payload.deviceKey === "string" ? payload.deviceKey.trim() : "";
    if (deviceKey.length < 8 || deviceKey.length > 100) {
      return Response.json({ error: "deviceKey non valido" }, { status: 400 });
    }

    const kind = cleanText(payload.kind, "Computer", 30);
    const platform = cleanText(payload.platform, "Sconosciuto", 40);
    const browser = cleanText(payload.browser, "Browser", 40);
    const address = isIpv4(payload.address) ? payload.address : null;
    const localIp = isIpv4(payload.localIp) ? payload.localIp : null;
    const macAddress =
      typeof payload.macAddress === "string" ? payload.macAddress.trim().toLowerCase() : null;
    const userAgent = typeof payload.userAgent === "string" ? payload.userAgent.slice(0, 500) : null;
    const screenSharing = payload.screenSharing ? 1 : 0;
    const now = new Date();

    const [device] = await db
      .insert(devices)
      .values({
        deviceKey,
        name: cleanText(payload.name, `${platform} · ${browser}`, 60),
        kind,
        platform,
        browser,
        address,
        localIp,
        macAddress,
        userAgent,
        screenSharing,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: devices.deviceKey,
        set: { kind, platform, browser, address, localIp, macAddress, userAgent, screenSharing, lastSeenAt: now },
      })
      .returning();

    publishDevicesChanged("heartbeat");
    return Response.json({ device });
  } catch (error) {
    console.warn("[NODO] heartbeat non valido:", error);
    return Response.json({ error: "Heartbeat non valido" }, { status: 400 });
  }
}
