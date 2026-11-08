"use client";

import { Bell, ChevronRight, Share2 } from "lucide-react";
import type { Section } from "@/lib/client/types";
import { MenuButton } from "@/components/Sidebar";

const TITLES: Record<Section, string> = {
  overview: "Panoramica",
  transfers: "File Condivisi Reali",
  devices: "Dispositivi Reali",
  "network-help": "Guida Connessione",
};

type Props = {
  section: Section;
  commandCount: number;
  onShare: () => void;
  onShowCommands: () => void;
  onOpenSidebar: () => void;
};

export function Topbar({ section, commandCount, onShare, onShowCommands, onOpenSidebar }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <MenuButton onOpen={onOpenSidebar} />
        <div className="breadcrumb">
          <span>NODO LAN</span>
          <ChevronRight size={14} />
          <strong>{TITLES[section]}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="primary-button small" onClick={onShare}>
          <Share2 size={13} /> Condividi URL
        </button>
        <button
          className="icon-button notification-button"
          onClick={onShowCommands}
          aria-label="Notifiche"
        >
          <Bell size={18} />
          {commandCount > 0 && <i />}
        </button>
      </div>
    </header>
  );
}
