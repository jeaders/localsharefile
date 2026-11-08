"use client";

import { useCallback, useState } from "react";

const SPECIAL_KEYS: Record<string, [string, string]> = {
  "⌫": ["Backspace", "Backspace"],
  "⇥": ["Tab", "Tab"],
  "⇪": ["CapsLock", "CapsLock"],
  "⇧": ["ShiftLeft", "Shift"],
  "↵": ["Enter", "Enter"],
  Ctrl: ["ControlLeft", "Control"],
  "←": ["ArrowLeft", "ArrowLeft"],
  "↓": ["ArrowDown", "ArrowDown"],
  "→": ["ArrowRight", "ArrowRight"],
  "↑": ["ArrowUp", "ArrowUp"],
  Spazio: ["Space", " "],
  "~": ["Backquote", "~"],
  "`": ["Backquote", "`"],
  "-": ["Minus", "-"],
  "=": ["Equal", "="],
  "[": ["BracketLeft", "["],
  "]": ["BracketRight", "]"],
  "\\": ["Backslash", "\\"],
  ";": ["Semicolon", ";"],
  "'": ["Quote", "'"],
  ",": ["Comma", ","],
  ".": ["Period", "."],
  "/": ["Slash", "/"],
};

function keyCodeFor(label: string): [string, string] {
  const special = SPECIAL_KEYS[label];
  if (special) return special;
  if (/^[a-z]$/.test(label)) return [`Key${label.toUpperCase()}`, label];
  if (/^[0-9]$/.test(label)) return [`Digit${label}`, label];
  return [label, label];
}

const ROWS = [
  ["~", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "⌫"],
  ["⇥", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["⇪", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "↑", "↵"],
  ["Ctrl", "←", "↓", "→", "Spazio"],
];

export function VirtualKeyboard({ onSend }: { onSend: (code: string, key: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);

  const handleKey = useCallback(
    (label: string) => {
      const [code, key] = keyCodeFor(label);
      void onSend(code, key);
    },
    [onSend],
  );

  return (
    <div className="virtual-keyboard">
      <div className="vk-header">
        <kbd>CTRL</kbd> <kbd>ALT</kbd> <kbd>⇧</kbd> <kbd>⌘</kbd>
        <button className="vk-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "Nascondi" : "Tastiera"}
        </button>
      </div>
      {open && (
        <div className="vk-grid">
          {ROWS.flat().map((label) => (
            <button key={label} className="vk-key" onClick={() => handleKey(label)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
