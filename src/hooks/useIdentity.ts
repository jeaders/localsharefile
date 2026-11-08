"use client";

import { useCallback, useMemo } from "react";
import { detectDevice } from "@/lib/client/format";
import { DEVICE_NAME_STORAGE, setStoredValue, useDeviceKey, useStoredString } from "@/lib/client/storage";

export function useIdentity() {
  const deviceKey = useDeviceKey();
  const customName = useStoredString(DEVICE_NAME_STORAGE);
  const identity = useMemo(() => detectDevice(), []);

  const renameThisDevice = useCallback((name: string) => {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    setStoredValue(DEVICE_NAME_STORAGE, clean);
  }, []);

  const displayName = customName || `${identity.platform} · ${identity.browser}`;

  return { deviceKey, customName, identity, displayName, renameThisDevice };
}
