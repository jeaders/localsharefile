import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "NODO — La tua rete, senza confini",
  description: "Condividi file e controlla i dispositivi nella tua rete locale.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
