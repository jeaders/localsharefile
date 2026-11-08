"use client";

import { Monitor, Pencil, Search, Send, Share2, Volume2 } from "lucide-react";
import type { ApiDevice } from "@/lib/client/types";
import { deviceAccent, deviceIcon, formatRelativeTime } from "@/lib/client/format";

type Props = {
  devices: ApiDevice[];
  visibleDevices: ApiDevice[];
  thisDeviceKey: string;
  search: string;
  onSearchChange: (value: string) => void;
  onShare: () => void;
  onBeep: (device: ApiDevice) => void;
  onMessage: (device: ApiDevice) => void;
  onRenameThisDevice: () => void;
};

export function DevicesSection({
  devices,
  visibleDevices,
  thisDeviceKey,
  search,
  onSearchChange,
  onShare,
  onBeep,
  onMessage,
  onRenameThisDevice,
}: Props) {
  return (
    <section className="page-section">
      <div className="section-page-heading">
        <div>
          <div className="eyebrow">
            <Monitor size={14} /> REGISTRO REALE
          </div>
          <h1>I Tuoi Computer Connessi</h1>
          <p>Ogni riga corrisponde a un computer che ha aperto NODO nel proprio browser.</p>
        </div>
        <button className="primary-button" onClick={onShare}>
          <Share2 size={16} /> Condividi URL di Connessione
        </button>
      </div>

      <div className="devices-page-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cerca computer..."
          />
        </div>
        <span>{visibleDevices.length} dispositivi registrati</span>
      </div>

      <div className="device-grid">
        {visibleDevices.map((device) => {
          const Icon = deviceIcon(device);
          const isThis = device.deviceKey === thisDeviceKey;
          const statusLabel =
            device.status === "online" ? "Online" : device.status === "idle" ? "Inattivo" : "Disconnesso";

          return (
            <div key={device.id} className="device-large-card card">
              <div className="large-card-header">
                <div className={`device-avatar large ${deviceAccent(device)}`}>
                  <Icon size={24} />
                </div>
                <span className={`status-pill ${device.status}`}>
                  <span
                    className={`status-dot ${device.status === "online" ? "online" : "offline"}`}
                  />
                  {statusLabel}
                </span>
              </div>

              <div className="large-card-name">
                <h3>
                  {device.name}
                  {isThis && <span className="this-badge">Questo PC</span>}
                </h3>
                <small>
                  {device.platform} · {device.browser}
                </small>
              </div>

              <div className="dev-meta-list">
                <div>
                  <span>Ultimo contatto:</span>
                  <strong>{formatRelativeTime(device.lastSeenAt)}</strong>
                </div>
                <div>
                  <span>Schermo:</span>
                  <strong>{device.screenSharing === 1 ? "In trasmissione" : "Inattivo"}</strong>
                </div>
                {device.localIp && (
                  <div>
                    <span>IP locale:</span> <strong>{device.localIp}</strong>
                  </div>
                )}
                {device.address && device.address !== device.localIp && (
                  <div>
                    <span>IP pubblico:</span> <strong>{device.address}</strong>
                  </div>
                )}
                {device.macAddress && (
                  <div>
                    <span>MAC:</span> <strong>{device.macAddress}</strong>
                  </div>
                )}
              </div>

              <div className="large-card-actions">
                {isThis ? (
                  <button onClick={onRenameThisDevice}>
                    <Pencil size={13} /> Rinomina Questo Computer
                  </button>
                ) : (
                  <>
                    <button onClick={() => onBeep(device)} title="Fai suonare">
                      <Volume2 size={13} /> Beep
                    </button>
                    <button onClick={() => onMessage(device)} title="Invia messaggio">
                      <Send size={13} /> Messaggio
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {devices.length === 0 && (
        <div className="empty-files-box">
          <Monitor size={36} />
          <strong>Nessun dispositivo registrato</strong>
          <p>Apri NODO su un altro computer della stessa rete.</p>
        </div>
      )}
    </section>
  );
}
