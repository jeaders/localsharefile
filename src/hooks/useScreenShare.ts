"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, storedToken } from "@/lib/client/api";
import { isHttpUrl, playRealBeep } from "@/lib/client/format";
import type {
  ApiDevice,
  IncomingSignal,
  RemoteCommand,
  RemoteCommandType,
  RemoteInputPayload,
} from "@/lib/client/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const HELPER_URL = "http://127.0.0.1:8899";

type PeerEntry = {
  offerer: RTCPeerConnection | null;
  receiver: RTCPeerConnection | null;
  pendingOffererCandidates: RTCIceCandidate[];
  pendingReceiverCandidates: RTCIceCandidate[];
  controlChannel: RTCDataChannel | null;
};

type Options = {
  thisDeviceKey: string;
  devices: ApiDevice[];
  selectedDevice: ApiDevice | null;
  httpsUrl: string;
  showToast: (message: string) => void;
  onCommandReceived: (command: RemoteCommand) => void;
};

function createPeerEntry(): PeerEntry {
  return {
    offerer: null,
    receiver: null,
    pendingOffererCandidates: [],
    pendingReceiverCandidates: [],
    controlChannel: null,
  };
}

/**
 * Tutta la parte WebRTC: condivisione schermo, ricezione dello stream,
 * controllo remoto (data channel) e comandi al computer selezionato.
 */
export function useScreenShare({
  thisDeviceKey,
  devices,
  selectedDevice,
  httpsUrl,
  showToast,
  onCommandReceived,
}: Options) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isViewingRemote, setIsViewingRemote] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isControllingRemote, setIsControllingRemote] = useState(false);
  const [nativeHelperUp, setNativeHelperUp] = useState<boolean | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());

  // Ref sempre aggiornate: i callback WebRTC non devono usare closure vecchie.
  const devicesRef = useRef(devices);
  const deviceKeyRef = useRef(thisDeviceKey);
  const toastRef = useRef(showToast);
  const commandRef = useRef(onCommandReceived);
  const helperStateRef = useRef<"unknown" | "up" | "down">("unknown");
  const helperQueueRef = useRef<Promise<void>>(Promise.resolve());
  const helperPendingMoveRef = useRef(false);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    deviceKeyRef.current = thisDeviceKey;
  }, [thisDeviceKey]);

  useEffect(() => {
    toastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    commandRef.current = onCommandReceived;
  }, [onCommandReceived]);

  const getPeer = useCallback((key: string): PeerEntry => {
    const existing = peersRef.current.get(key);
    if (existing) return existing;
    const created = createPeerEntry();
    peersRef.current.set(key, created);
    return created;
  }, []);

  const sendSignal = useCallback(async (toKey: string, type: string, payload: unknown) => {
    try {
      const response = await apiFetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDeviceKey: deviceKeyRef.current,
          toDeviceKey: toKey,
          type,
          payload: typeof payload === "string" ? payload : JSON.stringify(payload),
        }),
      });
      if (!response.ok) {
        console.warn("[NODO] segnale rifiutato dal server:", response.status);
      }
    } catch (error) {
      console.warn("[NODO] invio segnale fallito:", error);
    }
  }, []);

  /** Fallback: eventi DOM nella pagina condivisa quando l'helper nativo non c'è. */
  const dispatchInputEvent = useCallback((payload: RemoteInputPayload) => {
    const x = Math.max(0, Math.min(1, payload.x ?? 0)) * window.innerWidth;
    const y = Math.max(0, Math.min(1, payload.y ?? 0)) * window.innerHeight;
    const target = document.elementFromPoint(x, y) ?? document.body;
    const modifiers = {
      ctrlKey: payload.ctrlKey ?? false,
      altKey: payload.altKey ?? false,
      shiftKey: payload.shiftKey ?? false,
      metaKey: payload.metaKey ?? false,
    };
    const base = {
      clientX: x,
      clientY: y,
      button: payload.button ?? 0,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    };

    switch (payload.type) {
      case "mousedown":
        target.dispatchEvent(new MouseEvent("mousedown", base));
        break;
      case "mouseup":
        target.dispatchEvent(new MouseEvent("mouseup", base));
        break;
      case "mousemove":
        target.dispatchEvent(new MouseEvent("mousemove", base));
        break;
      case "click": {
        const element = target as HTMLElement;
        if (
          ["BUTTON", "A", "INPUT", "SELECT"].includes(element.tagName) &&
          typeof element.click === "function"
        ) {
          element.click();
        }
        element.dispatchEvent(new MouseEvent("click", base));
        break;
      }
      case "wheel":
        target.dispatchEvent(
          new WheelEvent("wheel", {
            ...base,
            deltaX: payload.deltaX ?? 0,
            deltaY: payload.deltaY ?? 0,
            deltaZ: payload.deltaZ ?? 0,
          }),
        );
        break;
      case "keydown":
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: payload.key ?? "",
            code: payload.code ?? "",
            bubbles: true,
            ...modifiers,
          }),
        );
        break;
      case "keyup":
        target.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: payload.key ?? "",
            code: payload.code ?? "",
            bubbles: true,
            ...modifiers,
          }),
        );
        break;
      default:
        break;
    }
  }, []);

  const checkNativeHelper = useCallback(async () => {
    if (helperStateRef.current !== "unknown") return;
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1200);
      const response = await fetch(`${HELPER_URL}/health`, { signal: controller.signal });
      window.clearTimeout(timer);
      helperStateRef.current = response.ok ? "up" : "down";
      setNativeHelperUp(response.ok);
    } catch {
      helperStateRef.current = "down";
      setNativeHelperUp(false);
    }
  }, []);

  const forwardToNativeHelper = useCallback(
    (payload: RemoteInputPayload) => {
      void checkNativeHelper();

      if (helperStateRef.current === "down") {
        dispatchInputEvent(payload);
        return;
      }

      if (payload.type === "mousemove") {
        if (helperPendingMoveRef.current) return;
        helperPendingMoveRef.current = true;
      }

      helperQueueRef.current = helperQueueRef.current.then(async () => {
        if (payload.type === "mousemove") helperPendingMoveRef.current = false;
        if (helperStateRef.current === "down") {
          dispatchInputEvent(payload);
          return;
        }
        try {
          const token = storedToken();
          const response = await fetch(`${HELPER_URL}/input`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "X-Nodo-Token": token } : {}),
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error(`helper ${response.status}`);
        } catch {
          helperStateRef.current = "down";
          setNativeHelperUp(false);
          dispatchInputEvent(payload);
        }
      });
    },
    [checkNativeHelper, dispatchInputEvent],
  );

  /** Gestione dei segnali in arrivo: comandi e handshake WebRTC. */
  const handleSignal = useCallback(
    async (signal: IncomingSignal) => {
      let parsed: Record<string, unknown> & { action?: string; text?: string; url?: string };
      try {
        parsed = JSON.parse(signal.payload) as typeof parsed;
      } catch {
        console.warn("[NODO] segnale con payload non valido:", signal.id);
        return;
      }

      const sender =
        devicesRef.current.find((device) => device.deviceKey === signal.fromDeviceKey)?.name ??
        "Altro computer";

      if (signal.type === "cmd") {
        if (parsed.action === "alert") {
          playRealBeep();
          toastRef.current(`Messaggio da ${sender}: "${parsed.text ?? ""}"`);
          commandRef.current({
            id: String(signal.id),
            fromName: sender,
            type: "alert",
            value: parsed.text,
            timestamp: Date.now(),
          });
        } else if (parsed.action === "beep") {
          playRealBeep();
          toastRef.current(`${sender} ha fatto suonare il tuo computer`);
        } else if (parsed.action === "openUrl") {
          if (typeof parsed.url === "string" && isHttpUrl(parsed.url)) {
            toastRef.current(`${sender} ti ha inviato un link: ${parsed.url}`);
            window.open(parsed.url, "_blank", "noopener,noreferrer");
          }
        } else if (parsed.action === "clipboard") {
          if (typeof parsed.text === "string" && navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(parsed.text);
              toastRef.current(`Testo copiato negli appunti da ${sender}`);
            } catch {
              toastRef.current("Il browser ha bloccato l'accesso agli appunti");
            }
          }
        }
        return;
      }

      if (signal.type === "offer") {
        const entry = getPeer(signal.fromDeviceKey);
        const description = parsed as unknown as RTCSessionDescriptionInit;
        const existing = entry.receiver;

        if (existing && existing.signalingState !== "closed" && existing.remoteDescription) {
          try {
            await existing.setRemoteDescription(new RTCSessionDescription(description));
            const answer = await existing.createAnswer();
            await existing.setLocalDescription(answer);
            await sendSignal(signal.fromDeviceKey, "answer", answer);
          } catch (error) {
            console.error("[NODO] rinegoziazione non riuscita:", error);
          }
          for (const candidate of entry.pendingReceiverCandidates) {
            try {
              await existing.addIceCandidate(candidate);
            } catch {
              // candidato non più valido
            }
          }
          entry.pendingReceiverCandidates = [];
          return;
        }

        if (existing && existing.signalingState !== "closed") existing.close();

        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        entry.receiver = peer;

        peer.ontrack = (event) => {
          if (event.streams[0]) {
            remoteStreamRef.current = event.streams[0];
          } else if (event.track) {
            if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
            remoteStreamRef.current.addTrack(event.track);
          }
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
          setIsViewingRemote(true);
          setNeedsPlay(true);
          toastRef.current(`Schermo di ${sender} collegato`);

          event.track.onended = () => {
            setIsViewingRemote(false);
            toastRef.current("Lo schermo remoto è stato disconnesso");
          };
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) void sendSignal(signal.fromDeviceKey, "candidate", event.candidate);
        };

        peer.ondatachannel = (event) => {
          const channel = event.channel;
          entry.controlChannel = channel;
          channel.onclose = () => {
            entry.controlChannel = null;
          };
        };

        await peer.setRemoteDescription(new RTCSessionDescription(description));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal(signal.fromDeviceKey, "answer", answer);

        for (const candidate of entry.pendingReceiverCandidates) {
          try {
            await peer.addIceCandidate(candidate);
          } catch {
            // candidato non più valido
          }
        }
        entry.pendingReceiverCandidates = [];
        return;
      }

      if (signal.type === "answer") {
        const entry = peersRef.current.get(signal.fromDeviceKey);
        const peer = entry?.offerer;
        if (!entry || !peer || peer.signalingState !== "have-local-offer") return;

        try {
          await peer.setRemoteDescription(
            new RTCSessionDescription(parsed as unknown as RTCSessionDescriptionInit),
          );
          toastRef.current(`Schermo di ${sender} condiviso con te`);
          for (const candidate of entry.pendingOffererCandidates) {
            try {
              await peer.addIceCandidate(candidate);
            } catch {
              // candidato non più valido
            }
          }
          entry.pendingOffererCandidates = [];
        } catch (error) {
          console.error("[NODO] risposta non applicata:", error);
        }
        return;
      }

      if (signal.type === "candidate") {
        const entry = getPeer(signal.fromDeviceKey);
        const candidate = new RTCIceCandidate(parsed as unknown as RTCIceCandidateInit);

        if (entry.offerer && entry.offerer.signalingState !== "closed") {
          if (entry.offerer.remoteDescription) {
            try {
              await entry.offerer.addIceCandidate(candidate);
            } catch {
              // candidato non più valido
            }
          } else {
            entry.pendingOffererCandidates.push(candidate);
          }
        }

        if (entry.receiver && entry.receiver.signalingState !== "closed") {
          if (entry.receiver.remoteDescription) {
            try {
              await entry.receiver.addIceCandidate(candidate);
            } catch {
              // candidato non più valido
            }
          } else {
            entry.pendingReceiverCandidates.push(candidate);
          }
        }

        if (!entry.offerer && !entry.receiver) entry.pendingOffererCandidates.push(candidate);
      }
    },
    [getPeer, sendSignal],
  );

  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
    for (const entry of peersRef.current.values()) {
      entry.offerer?.close();
      entry.receiver?.close();
    }
    peersRef.current.clear();
    remoteStreamRef.current = null;
    setIsScreenSharing(false);
    setIsViewingRemote(false);
    setIsControllingRemote(false);
    toastRef.current("Condivisione schermo interrotta");
  }, []);

  const connectStreamToDevice = useCallback(
    async (targetKey: string, stream: MediaStream) => {
      const entry = getPeer(targetKey);
      const existing = entry.offerer;

      if (existing && existing.signalingState !== "closed") {
        if (existing.signalingState === "have-local-offer" || existing.signalingState === "stable") {
          for (const track of stream.getTracks()) {
            if (!existing.getSenders().find((sender) => sender.track === track)) {
              existing.addTrack(track, stream);
            }
          }
          return;
        }
        existing.close();
      }

      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      entry.offerer = peer;

      for (const track of stream.getTracks()) peer.addTrack(track, stream);

      const channel = peer.createDataChannel("control", { ordered: true });
      entry.controlChannel = channel;
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: RemoteInputPayload;
          };
          if (message.type === "input" && message.payload) {
            forwardToNativeHelper(message.payload);
          }
        } catch {
          // messaggio non valido: ignorato
        }
      };
      channel.onclose = () => {
        entry.controlChannel = null;
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) void sendSignal(targetKey, "candidate", event.candidate);
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(targetKey, "offer", offer);
    },
    [forwardToNativeHelper, getPeer, sendSignal],
  );

  const startScreenShare = useCallback(async () => {
    setScreenError(null);

    if (window.location.protocol !== "https:") {
      setScreenError(
        `La condivisione schermo richiede HTTPS. Apri ${httpsUrl} su questo e sull'altro dispositivo.`,
      );
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError("getDisplayMedia non supportato: usa Chrome, Edge o Firefox desktop recenti.");
      return;
    }
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      setScreenError("La condivisione schermo non è supportata su mobile: usa un desktop.");
      return;
    }
    if (/Mac OS X|Macintosh/i.test(navigator.userAgent)) {
      toastRef.current(
        "macOS: nel selettore scegli l'intero schermo. Se non appare, abilita la Registrazione schermo per il browser.",
      );
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: false,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => {});
      }
      setIsScreenSharing(true);
      toastRef.current("Condivisione schermo avviata");

      const track = stream.getVideoTracks()[0];
      if (track) track.onended = () => stopScreenShare();

      const target =
        selectedDevice && selectedDevice.deviceKey !== thisDeviceKey
          ? selectedDevice
          : (devicesRef.current.find(
              (device) => device.deviceKey !== thisDeviceKey && device.status === "online",
            ) ?? null);

      if (!target) {
        toastRef.current("Nessun altro computer online: apri NODO su un secondo PC");
        return;
      }

      await connectStreamToDevice(target.deviceKey, stream);
    } catch (error) {
      const failure = error as { name?: string; message?: string };
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;

      if (failure.name === "NotAllowedError") {
        setScreenError(
          /Mac OS X|Macintosh/i.test(navigator.userAgent)
            ? "Permesso negato su macOS: Impostazioni di Sistema > Privacy e Sicurezza > Registrazione Schermo, abilita il browser e riprova."
            : "Permesso di condivisione schermo negato. Riprova e conferma la selezione.",
        );
      } else if (failure.name === "NotSupportedError" || failure.name === "TypeError") {
        setScreenError(`Questo browser non permette la cattura schermo. Prova da ${httpsUrl}.`);
      } else {
        setScreenError(
          `Errore condivisione schermo: ${failure.message ?? failure.name ?? "sconosciuto"}`,
        );
      }
    }
  }, [connectStreamToDevice, httpsUrl, selectedDevice, stopScreenShare, thisDeviceKey]);

  const findOpenChannel = useCallback((): RTCDataChannel | null => {
    for (const entry of peersRef.current.values()) {
      if (entry.controlChannel?.readyState === "open") return entry.controlChannel;
    }
    return null;
  }, []);

  // Inoltro mouse/tastiera quando il controllo remoto è attivo.
  useEffect(() => {
    if (!isControllingRemote || !isViewingRemote) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    const sendInput = (
      type: string,
      x: number,
      y: number,
      extra: Record<string, unknown> = {},
    ) => {
      const channel = findOpenChannel();
      if (!channel) return;
      const rect = video.getBoundingClientRect();
      const normalizedX = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      const normalizedY = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
      channel.send(
        JSON.stringify({ type: "input", payload: { type, x: normalizedX, y: normalizedY, ...extra } }),
      );
    };

    const onMouseMove = (event: MouseEvent) =>
      sendInput("mousemove", event.clientX, event.clientY, {
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    const onMouseDown = (event: MouseEvent) =>
      sendInput("mousedown", event.clientX, event.clientY, {
        button: event.button,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    const onMouseUp = (event: MouseEvent) =>
      sendInput("mouseup", event.clientX, event.clientY, {
        button: event.button,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    const onClick = (event: MouseEvent) =>
      sendInput("click", event.clientX, event.clientY, {
        button: event.button,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    const onWheel = (event: WheelEvent) =>
      sendInput("wheel", event.clientX, event.clientY, {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
      });

    const onKeyDown = (event: KeyboardEvent) => {
      const channel = findOpenChannel();
      if (!channel) return;
      event.preventDefault();
      channel.send(
        JSON.stringify({
          type: "input",
          payload: {
            type: "keydown",
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
          },
        }),
      );
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const channel = findOpenChannel();
      if (!channel) return;
      event.preventDefault();
      channel.send(
        JSON.stringify({
          type: "input",
          payload: {
            type: "keyup",
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
          },
        }),
      );
    };

    video.addEventListener("mousemove", onMouseMove);
    video.addEventListener("mousedown", onMouseDown);
    video.addEventListener("mouseup", onMouseUp);
    video.addEventListener("click", onClick);
    video.addEventListener("wheel", onWheel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      video.removeEventListener("mousemove", onMouseMove);
      video.removeEventListener("mousedown", onMouseDown);
      video.removeEventListener("mouseup", onMouseUp);
      video.removeEventListener("click", onClick);
      video.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [findOpenChannel, isControllingRemote, isViewingRemote]);

  // Il video remoto viene montato condizionalmente: imposto srcObject qui.
  useEffect(() => {
    if (!isViewingRemote) return;
    const video = remoteVideoRef.current;
    if (!video || !remoteStreamRef.current) return;
    video.srcObject = remoteStreamRef.current;
    void video.play().catch(() => setNeedsPlay(true));
  }, [isViewingRemote]);

  const sendCommandTo = useCallback(
    async (device: ApiDevice, type: RemoteCommandType, value?: string) => {
      if (device.deviceKey === deviceKeyRef.current) {
        toastRef.current("Non puoi inviare comandi a questo stesso computer");
        return;
      }

      const payload: { action: RemoteCommandType; text?: string; url?: string } = { action: type };
      if (type === "alert" || type === "clipboard") payload.text = value || "Ciao da NODO!";
      if (type === "openUrl") {
        const url = value || "https://www.google.com";
        if (!isHttpUrl(url)) {
          toastRef.current("Sono ammessi solo indirizzi http/https");
          return;
        }
        payload.url = url;
      }

      await sendSignal(device.deviceKey, "cmd", payload);
      toastRef.current(`Comando inviato a ${device.name}`);
    },
    [sendSignal],
  );

  const sendCommand = useCallback(
    (type: RemoteCommandType, value?: string) => {
      if (!selectedDevice) {
        toastRef.current("Seleziona prima un ALTRO computer della lista");
        return;
      }
      void sendCommandTo(selectedDevice, type, value);
    },
    [selectedDevice, sendCommandTo],
  );

  const sendVirtualKey = useCallback(
    async (code: string, key: string) => {
      const channel = findOpenChannel();
      if (!channel) return;
      channel.send(JSON.stringify({ type: "input", payload: { type: "keydown", key, code } }));
      await new Promise((resolve) => setTimeout(resolve, 30));
      channel.send(JSON.stringify({ type: "input", payload: { type: "keyup", key, code } }));
    },
    [findOpenChannel],
  );

  const toggleRemoteControl = useCallback(() => {
    setIsControllingRemote((current) => !current);
  }, []);

  /** Il componente possiede gli elementi <video> e li registra qui. */
  const registerVideos = useCallback(
    (local: HTMLVideoElement | null, remote: HTMLVideoElement | null) => {
      localVideoRef.current = local;
      remoteVideoRef.current = remote;
      if (local && localStreamRef.current) local.srcObject = localStreamRef.current;
      if (remote && remoteStreamRef.current) remote.srcObject = remoteStreamRef.current;
    },
    [],
  );

  const playRemoteVideo = useCallback(() => {
    const video = remoteVideoRef.current;
    if (!video) return;
    void video
      .play()
      .then(() => setNeedsPlay(false))
      .catch((error: unknown) => console.warn("[NODO] play non riuscito:", error));
  }, []);

  return {
    // stato
    isScreenSharing,
    isViewingRemote,
    needsPlay,
    isFullScreen,
    isControllingRemote,
    nativeHelperUp,
    screenError,
    // elementi video
    registerVideos,
    playRemoteVideo,
    // azioni
    startScreenShare,
    stopScreenShare,
    sendCommand,
    sendCommandTo,
    sendVirtualKey,
    toggleRemoteControl,
    setNeedsPlay,
    setIsFullScreen,
    handleSignal,
  };
}

export type ScreenShareState = ReturnType<typeof useScreenShare>;
