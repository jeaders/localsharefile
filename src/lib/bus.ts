// Event bus in-process: notifica i client SSE quando i dati cambiano.
// Registrato su globalThis per sopravvivere all'hot reload in sviluppo.

export type SignalRecord = {
  id: number;
  fromDeviceKey: string;
  toDeviceKey: string;
  type: string;
  payload: string;
  createdAt: Date | string;
};

type Listener<T> = (value: T) => void;

type BusState = {
  devices: Set<Listener<string>>;
  signals: Set<Listener<SignalRecord>>;
};

const globalForBus = globalThis as typeof globalThis & { __nodoBus?: BusState };

const bus: BusState =
  globalForBus.__nodoBus ?? (globalForBus.__nodoBus = { devices: new Set(), signals: new Set() });

export function publishDevicesChanged(reason = "update"): void {
  for (const listener of bus.devices) {
    try {
      listener(reason);
    } catch (error) {
      console.warn("[NODO] listener dispositivi fallito:", error);
    }
  }
}

export function subscribeDevices(listener: Listener<string>): () => void {
  bus.devices.add(listener);
  return () => {
    bus.devices.delete(listener);
  };
}

export function publishSignal(signal: SignalRecord): void {
  for (const listener of bus.signals) {
    try {
      listener(signal);
    } catch (error) {
      console.warn("[NODO] listener segnali fallito:", error);
    }
  }
}

export function subscribeSignals(listener: Listener<SignalRecord>): () => void {
  bus.signals.add(listener);
  return () => {
    bus.signals.delete(listener);
  };
}
