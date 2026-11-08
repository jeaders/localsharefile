"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/client/api";
import type { DeviceIdentity } from "@/lib/client/types";

const HEARTBEAT_MS = 6_000;

type Options = {
  enabled: boolean;
  deviceKey: string;
  name: string;
  identity: DeviceIdentity;
  screenSharing: boolean;
};

async function detectLocalIp(): Promise<string | null> {
  try {
    const connection = new RTCPeerConnection({ iceServers: [] });
    connection.createDataChannel("");
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    const match = connection.localDescription?.sdp.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
    connection.close();
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Tiene aggiornato lo stato del dispositivo nel registro. */
export function usePresence({ enabled, deviceKey, name, identity, screenSharing }: Options) {
  const localIpRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !deviceKey) return;

    const send = async () => {
      try {
        if (!localIpRef.current) {
          localIpRef.current = await detectLocalIp();
        }
        await apiFetch("/api/devices/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceKey,
            name,
            kind: identity.kind,
            platform: identity.platform,
            browser: identity.browser,
            localIp: localIpRef.current,
            macAddress: null,
            userAgent: navigator.userAgent,
            screenSharing: screenSharing ? 1 : 0,
          }),
        });
      } catch (error) {
        console.warn("[NODO] heartbeat non riuscito:", error);
      }
    };

    void send();
    const timer = window.setInterval(() => {
      void send();
    }, HEARTBEAT_MS);

    return () => window.clearInterval(timer);
  }, [deviceKey, enabled, identity, name, screenSharing]);
}
