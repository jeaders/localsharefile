import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mouse, keyboard, screen, Button, Key, Point } from "@nut-tree-fork/nut-js";

const PORT = 8899;

// ---------------------------------------------------------------------------
// Sicurezza: l'helper muove il mouse e la tastiera REALI della macchina.
// Accetta solo origini di rete locale/privata e richiede il token condiviso
// dell'app (stesso valore di data/nodo-token del server).
// ---------------------------------------------------------------------------
const PRIVATE_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

const TOKEN_FILE = join(dirname(dirname(fileURLToPath(import.meta.url))), "data", "nodo-token");

function loadToken() {
  const fromEnv = process.env.NODO_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const stored = readFileSync(TOKEN_FILE, "utf8").trim();
    return stored || null;
  } catch {
    return null;
  }
}

const APP_TOKEN = loadToken();

function isAllowedOrigin(origin) {
  if (typeof origin !== "string" || origin.length === 0) return false;
  return PRIVATE_ORIGIN.test(origin);
}

function tokenMatches(req) {
  if (!APP_TOKEN) return false;
  const provided = req.headers["x-nodo-token"];
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(APP_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Nodo-Token");
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

let screenW = 1280;
let screenH = 800;
let ready = false;

const CODE_TO_KEY = {
  KeyA: "A", KeyB: "B", KeyC: "C", KeyD: "D", KeyE: "E", KeyF: "F", KeyG: "G",
  KeyH: "H", KeyI: "I", KeyJ: "J", KeyK: "K", KeyL: "L", KeyM: "M", KeyN: "N",
  KeyO: "O", KeyP: "P", KeyQ: "Q", KeyR: "R", KeyS: "S", KeyT: "T", KeyU: "U",
  KeyV: "V", KeyW: "W", KeyX: "X", KeyY: "Y", KeyZ: "Z",
  Digit0: "Num0", Digit1: "Num1", Digit2: "Num2", Digit3: "Num3", Digit4: "Num4",
  Digit5: "Num5", Digit6: "Num6", Digit7: "Num7", Digit8: "Num8", Digit9: "Num9",
  Minus: "Minus", Equal: "Equal", Backquote: "Grave",
  BracketLeft: "LeftBracket", BracketRight: "RightBracket", Backslash: "Backslash",
  Semicolon: "Semicolon", Quote: "Quote", Comma: "Comma", Period: "Period", Slash: "Slash",
  Space: "Space", Enter: "Enter", NumpadEnter: "Enter", Backspace: "Backspace",
  Tab: "Tab", CapsLock: "CapsLock", Escape: "Escape", Delete: "Delete", Insert: "Insert",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", NumLock: "NumLock",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  ShiftLeft: "LeftShift", ShiftRight: "RightShift",
  ControlLeft: "LeftControl", ControlRight: "RightControl",
  AltLeft: "LeftAlt", AltRight: "RightAlt",
  MetaLeft: "LeftSuper", MetaRight: "RightSuper",
  F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
};

const MOD_FLAG_TO_KEY = [
  ["ctrlKey", Key.LeftControl],
  ["altKey", Key.LeftAlt],
  ["shiftKey", Key.LeftShift],
  ["metaKey", Key.LeftSuper],
];

const MOUSE_BUTTON = [Button.LEFT, Button.MIDDLE, Button.RIGHT];

function resolveKey(code, key) {
  const name = code && CODE_TO_KEY[code];
  if (name && Key[name] !== undefined) return Key[name];
  if (key && key.length === 1 && Key[key] !== undefined && isNaN(Number(key))) return Key[key];
  return null;
}

function modifiersOf(payload) {
  const mods = [];
  for (const [flag, nutKey] of MOD_FLAG_TO_KEY) {
    if (payload[flag]) mods.push(nutKey);
  }
  return mods;
}

async function handleInput(payload) {
  const x = Math.round(Math.max(0, Math.min(1, payload.x ?? 0)) * screenW);
  const y = Math.round(Math.max(0, Math.min(1, payload.y ?? 0)) * screenH);
  const point = new Point(x, y);

  switch (payload.type) {
    case "mousemove":
      await mouse.setPosition(point);
      break;

    case "mousedown":
      await mouse.setPosition(point);
      await mouse.pressButton(MOUSE_BUTTON[payload.button] ?? Button.LEFT);
      break;

    case "mouseup":
      await mouse.releaseButton(MOUSE_BUTTON[payload.button] ?? Button.LEFT);
      break;

    case "click": {
      await mouse.setPosition(point);
      const button = MOUSE_BUTTON[payload.button] ?? Button.LEFT;
      if (button === Button.LEFT) await mouse.leftClick();
      else if (button === Button.RIGHT) await mouse.rightClick();
      else await mouse.click(button);
      break;
    }

    case "wheel": {
      const delta = Number(payload.deltaY ?? 0);
      if (delta !== 0) {
        const amount = Math.min(10, Math.max(1, Math.round(Math.abs(delta) / 100)));
        if (delta > 0) await mouse.scrollDown(amount);
        else await mouse.scrollUp(amount);
      }
      break;
    }

    case "keydown": {
      const mods = modifiersOf(payload);
      const nutKey = resolveKey(payload.code, payload.key);
      if (nutKey !== null) {
        try {
          await keyboard.pressKey(...mods, nutKey);
        } catch {
          await keyboard.pressKey(nutKey).catch(() => {});
        }
        if (mods.length === 0) await keyboard.releaseKey(nutKey).catch(() => {});
      } else if (payload.key && payload.key.length === 1) {
        await keyboard.type(payload.key).catch(() => {});
      }
      break;
    }

    case "keyup": {
      const nutKey = resolveKey(payload.code, payload.key);
      if (nutKey !== null) await keyboard.releaseKey(...modifiersOf(payload), nutKey).catch(() => {});
      break;
    }

    case "text":
      if (payload.text) await keyboard.type(String(payload.text)).catch(() => {});
      break;

    default:
      break;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error("payload troppo grande"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON non valido"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const corsAllowed = applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(corsAllowed ? 204 : 403);
    res.end();
    return;
  }

  if (!corsAllowed) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end('{"ok":false,"error":"origine non ammessa"}');
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ready, screen: { width: screenW, height: screenH } }));
    return;
  }

  if (req.method === "POST" && req.url === "/input") {
    if (!tokenMatches(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"ok":false,"error":"token mancante o non valido"}');
      return;
    }
    if (!ready) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end('{"ok":false,"error":"non pronto"}');
      return;
    }
    try {
      const body = await readBody(req);
      await handleInput(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end('{"error":"non trovato"}');
});

async function detectScreen() {
  try {
    screenW = await screen.width();
    screenH = await screen.height();
    if (!screenW || !screenH) throw new Error("risoluzione non valida");
    console.log(`[NODO-HELPER] Schermo rilevato: ${screenW}x${screenH}`);
  } catch (e) {
    screenW = 1280;
    screenH = 800;
    console.warn(`[NODO-HELPER] Risoluzione non rilevata (${e.message}), uso ${screenW}x${screenH}`);
  }
}

server.listen(PORT, "127.0.0.1", async () => {
  mouse.config.autoDelayMs = 0;
  keyboard.config.autoDelayMs = 0;
  await detectScreen();
  ready = true;
  console.log(`[NODO-HELPER] In ascolto su http://127.0.0.1:${PORT}`);
  console.log("[NODO-HELPER] Input di sistema REALE attivo.");
  if (!APP_TOKEN) {
    console.warn(
      "[NODO-HELPER] Nessun token trovato: /input rifiuterà tutte le richieste. " +
        "Avvia prima il server NODO (crea data/nodo-token) oppure imposta NODO_TOKEN.",
    );
  }
  console.log(
    "[NODO-HELPER] Accetto solo origini locali/private con token valido. " +
      "macOS: serve il permesso Accessibilità per il terminale che esegue lo script.",
  );
});
