"use client";

import { AlertTriangle, ArrowLeftRight, Bell, Copy, Monitor, UploadCloud, Video, VideoOff, Zap } from "lucide-react";
import type { ApiDevice, RemoteCommand, ServerInfo, SharedFile } from "@/lib/client/types";
import type { ScreenShareState } from "@/hooks/useScreenShare";
import { RemoteScreenCard } from "@/components/RemoteScreenCard";
import { DeviceListCard } from "@/components/DeviceListCard";
import { FilesTable } from "@/components/FilesTable";

type Props = {
  devices: ApiDevice[];
  files: SharedFile[];
  onlineDevices: ApiDevice[];
  thisDeviceKey: string;
  selectedDevice: ApiDevice | null;
  selectedDeviceId: number | null;
  screen: ScreenShareState;
  serverInfo: ServerInfo | null;
  receivedCommands: RemoteCommand[];
  onClearCommands: () => void;
  onSelectDevice: (id: number) => void;
  onBeepDevice: (device: ApiDevice) => void;
  onRenameDevice: (device: ApiDevice) => void;
  onRemoveDevice: (device: ApiDevice) => void;
  onShare: () => void;
  onUploadClick: () => void;
  onRefresh: () => void;
  showToast: (message: string) => void;
};

export function OverviewSection({
  devices,
  files,
  onlineDevices,
  thisDeviceKey,
  selectedDevice,
  selectedDeviceId,
  screen,
  serverInfo,
  receivedCommands,
  onClearCommands,
  onSelectDevice,
  onBeepDevice,
  onRenameDevice,
  onRemoveDevice,
  onShare,
  onUploadClick,
  onRefresh,
  showToast,
}: Props) {
  const showNetworkWarning =
    Boolean(serverInfo) &&
    (serverInfo!.isCloudSandbox || serverInfo!.localIps.some((ip) => ip.isLinkLocal));

  return (
    <>
      {showNetworkWarning && (
        <div className="ip-warning-banner">
          <AlertTriangle size={20} className="warning-icon" />
          <div className="ip-warning-content">
            <strong>Connessione non locale rilevata</strong>
            <p>
              Questo server non sembra in ascolto sulla rete Wi-Fi di casa. Per collegare i PC
              direttamente in locale:
            </p>
            <div className="ip-warning-solutions">
              <div className="sol-card">
                <span>Opzione consigliata</span>
                <p>Avvia NODO sul PC principale con:</p>
                <code>npm run server</code>
                <small>
                  Poi apri <b>https://{serverInfo?.primaryIp ?? "IP-del-PC"}:{serverInfo?.httpsPort ?? 3443}</b> dagli altri PC
                </small>
              </div>
              <div className="sol-card">
                <span>Indirizzo attuale</span>
                <p>Il browser ha aperto:</p>
                <code>{serverInfo?.currentOrigin ?? "(indirizzo sconosciuto)"}</code>
                <button onClick={onShare} className="mini-btn">
                  <Copy size={11} /> Copia URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receivedCommands.length > 0 && (
        <div className="received-box">
          <div className="received-header">
            <strong>
              <Bell size={14} /> Ultimi comandi ricevuti dagli altri computer:
            </strong>
            <button onClick={onClearCommands} className="text-button">
              Cancella
            </button>
          </div>
          <div className="received-list">
            {receivedCommands.slice(0, 3).map((command) => (
              <div key={command.id} className="received-item">
                <span>
                  Da <strong>{command.fromName}</strong>:
                </span>
                <em>&quot;{command.value}&quot;</em>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="hero-panel real-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Zap size={14} /> NODO LAN OPERATIVO
          </span>
          <h2>
            I tuoi computer,
            <br />
            <em>nessun dato finto.</em>
          </h2>
          <p>
            Apri questa pagina sugli altri computer: appariranno qui. Puoi inviare file reali,
            farli suonare, mandare messaggi e condividere lo schermo.
          </p>
          <div className="hero-btn-row">
            <button className="primary-button" onClick={onUploadClick}>
              <UploadCloud size={16} /> Carica File Reale
            </button>
            <button
              className="secondary-button"
              onClick={screen.isScreenSharing ? screen.stopScreenShare : screen.startScreenShare}
            >
              {screen.isScreenSharing ? <VideoOff size={16} /> : <Video size={16} />}
              {screen.isScreenSharing ? "Interrompi Schermo" : "Condividi Mio Schermo"}
            </button>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon purple">
            <Monitor size={18} />
          </div>
          <div>
            <span>Computer Online</span>
            <strong>
              {onlineDevices.length} <small>/ {devices.length}</small>
            </strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon blue">
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <span>File Condivisi Reali</span>
            <strong>{files.length}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green">
            <Video size={18} />
          </div>
          <div>
            <span>Schermi in Streaming</span>
            <strong>{devices.filter((device) => device.screenSharing === 1).length}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <RemoteScreenCard screen={screen} selectedDevice={selectedDevice} thisDeviceKey={thisDeviceKey} />
        <DeviceListCard
          devices={devices}
          thisDeviceKey={thisDeviceKey}
          selectedDeviceId={selectedDeviceId}
          onlineCount={onlineDevices.length}
          onSelect={onSelectDevice}
          onBeep={onBeepDevice}
          onRename={onRenameDevice}
          onRemove={onRemoveDevice}
          onShare={onShare}
        />
      </section>

      <section className="card activity-card">
        <div className="card-header">
          <div>
            <h3>File Condivisi Reali</h3>
            <p>File memorizzati sul server e scaricabili da qualsiasi computer della rete</p>
          </div>
          <button className="primary-button small" onClick={onUploadClick}>
            <UploadCloud size={14} /> Carica File
          </button>
        </div>
        <FilesTable files={files} onRefresh={onRefresh} showToast={showToast} />
      </section>
    </>
  );
}
