import {
  FileArchive,
  FileImage,
  FileText,
  Film,
  Laptop,
  Monitor,
  Music2,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";
import type { DeviceIdentity } from "./types";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getFileIcon(mime: string, name: string): LucideIcon {
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) return FileImage;
  if (mime.startsWith("video/") || /\.(mp4|webm|mkv|mov)$/i.test(name)) return Film;
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|flac)$/i.test(name)) return Music2;
  if (/\.(zip|tar|gz|7z|rar)$/i.test(name)) return FileArchive;
  return FileText;
}

export function formatRelativeTime(iso: string): string {
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 15) return "Adesso";
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.round(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h fa`;
  return new Date(iso).toLocaleDateString("it-IT");
}

export function deviceIcon(device: { kind: string; platform: string }): LucideIcon {
  if (device.kind === "Smartphone") return Smartphone;
  if (device.kind === "Tablet") return Tablet;
  if (device.platform === "macOS") return Laptop;
  return Monitor;
}

export function deviceAccent(device: { kind: string; platform: string }): string {
  if (device.platform === "macOS") return "purple";
  if (device.kind === "Smartphone") return "orange";
  if (device.kind === "Tablet") return "green";
  return "blue";
}

export function detectDevice(): DeviceIdentity {
  if (typeof navigator === "undefined") {
    return { kind: "Computer", platform: "Computer", browser: "Browser" };
  }

  const ua = navigator.userAgent;
  let kind = "Computer";
  if (/iPad|Tablet/i.test(ua)) kind = "Tablet";
  else if (/Mobi|Android|iPhone/i.test(ua)) kind = "Smartphone";

  let platform = "Computer";
  if (/Windows/i.test(ua)) platform = "Windows";
  else if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad/i.test(ua)) platform = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) platform = "macOS";
  else if (/Linux/i.test(ua)) platform = "Linux";

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return { kind, platform, browser };
}

/** Beep reale sul computer ricevente tramite Web Audio API. */
export function playRealBeep(): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.35);
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
    oscillator.onended = () => {
      void context.close();
    };
  } catch (error) {
    console.warn("Impossibile suonare il beep:", error);
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
