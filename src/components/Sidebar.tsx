"use client";

import {
  ArrowLeftRight,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Monitor,
  Pencil,
  Wifi,
  X,
} from "lucide-react";
import type { ApiDevice, Section } from "@/lib/client/types";

type Props = {
  activeSection: Section;
  onSelectSection: (section: Section) => void;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onlineCount: number;
  sharedCount: number;
  deviceCount: number;
  thisDevice: ApiDevice | null;
  displayName: string;
  onRenameThisDevice: () => void;
};

export function Sidebar({
  activeSection,
  onSelectSection,
  sidebarOpen,
  onCloseSidebar,
  onlineCount,
  sharedCount,
  deviceCount,
  thisDevice,
  displayName,
  onRenameThisDevice,
}: Props) {
  const go = (section: Section) => {
    onSelectSection(section);
    onCloseSidebar();
  };

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <span />
          </div>
          <span className="brand-name">
            nodo<span>.</span>
          </span>
          <button className="mobile-close" onClick={onCloseSidebar} aria-label="Chiudi menu">
            <X size={18} />
          </button>
        </div>

        <div className="network-status">
          <span className="status-dot online" />
          <div>
            <strong>Rete Attiva</strong>
            <small>
              {onlineCount} online · {sharedCount} file condivisi
            </small>
          </div>
          <Wifi size={16} />
        </div>

        <div className="nav-group">
          <p className="nav-label">Workspace</p>
          <nav>
            <button
              className={`nav-item ${activeSection === "overview" ? "active" : ""}`}
              onClick={() => go("overview")}
            >
              <LayoutDashboard size={18} />
              <span>Panoramica</span>
            </button>
            <button
              className={`nav-item ${activeSection === "transfers" ? "active" : ""}`}
              onClick={() => go("transfers")}
            >
              <ArrowLeftRight size={18} />
              <span>File Reali</span>
              {sharedCount > 0 && <em>{sharedCount}</em>}
            </button>
            <button
              className={`nav-item ${activeSection === "devices" ? "active" : ""}`}
              onClick={() => go("devices")}
            >
              <Monitor size={18} />
              <span>Dispositivi</span>
              <em>{deviceCount}</em>
            </button>
            <button
              className={`nav-item ${activeSection === "network-help" ? "active" : ""}`}
              onClick={() => go("network-help")}
            >
              <CircleHelp size={18} />
              <span>Come Connettere i PC</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="this-device-card">
            <div className="this-device-header">
              <span className="status-dot online" />
              <strong>Questo computer</strong>
              <button onClick={onRenameThisDevice} title="Rinomina questo PC" className="rename-btn">
                <Pencil size={12} />
              </button>
            </div>
            <p className="this-device-name">{displayName}</p>
            <small className="this-device-meta">
              {thisDevice?.platform ?? "—"} · {thisDevice?.browser ?? "—"}
            </small>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-overlay" onClick={onCloseSidebar} aria-label="Chiudi overlay" />
      )}
    </>
  );
}

export function MenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="menu-button" onClick={onOpen} aria-label="Apri menu">
      <Menu size={21} />
    </button>
  );
}
