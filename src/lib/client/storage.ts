"use client";

import { useCallback, useSyncExternalStore } from "react";

const DEVICE_KEY_STORAGE = "nodo-device-key-v2";
export const DEVICE_NAME_STORAGE = "nodo-device-name-v2";

const subscribers = new Map<string, Set<() => void>>();

function notify(key: string): void {
  const listeners = subscribers.get(key);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function subscribe(key: string, callback: () => void): () => void {
  let listeners = subscribers.get(key);
  if (!listeners) {
    listeners = new Set();
    subscribers.set(key, listeners);
  }
  listeners.add(callback);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function readValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function setStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    console.warn("[NODO] localStorage non disponibile");
  }
  notify(key);
}

/**
 * Legge un valore da localStorage senza mismatch di idratazione:
 * il server usa sempre "" e React riallinea dopo il mount.
 */
export function useStoredString(key: string): string {
  const subscribeToKey = useCallback((callback: () => void) => subscribe(key, callback), [key]);
  const getSnapshot = useCallback(() => readValue(key), [key]);
  return useSyncExternalStore(subscribeToKey, getSnapshot, () => "");
}

let deviceKeyCache: string | null = null;

function ensureDeviceKey(): string {
  if (deviceKeyCache) return deviceKeyCache;
  const existing = readValue(DEVICE_KEY_STORAGE);
  if (existing) {
    deviceKeyCache = existing;
    return existing;
  }
  const created = `nodo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  deviceKeyCache = created;
  try {
    window.localStorage.setItem(DEVICE_KEY_STORAGE, created);
  } catch {
    console.warn("[NODO] impossibile salvare l'identità del dispositivo");
  }
  return created;
}

export function useDeviceKey(): string {
  return useSyncExternalStore(
    () => () => {},
    ensureDeviceKey,
    () => "",
  );
}

export { DEVICE_KEY_STORAGE };
