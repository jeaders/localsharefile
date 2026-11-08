"use client";

import { Pencil, Plus, Trash2, Volume2 } from "lucide-react";
import type { ApiDevice } from "@/lib/client/types";
import { deviceAccent, deviceIcon } from "@/lib/client/format";

export function DeviceInfoLines({ device }: { device: ApiDevice }) {
  return (
    <>
      {device.localIp && <small>IP locale: {device.localIp}</small>}
      {device.address && device.address !== device.localIp && (
        <small>IP pubblico: {device.address}</small>
      )}
      {device.macAddress && <small>MAC: {device.macAddress}</small>}
      {device.userAgent && <small title={device.userAgent}>UA: {device.userAgent.slice(0, 40)}…</small>}
    </>
  );
}

type Props = {
  devices: ApiDevice[];
  thisDeviceKey: string;
  selectedDeviceId: number | null;
  onlineCount: number;
  onSelect: (id: number) => void;
  onBeep: (device: ApiDevice) => void;
  onRename: (device: ApiDevice) => void;
  onRemove: (device: ApiDevice) => void;
  onShare: () => void;
};

export function DeviceListCard({
  devices,
  thisDeviceKey,
  selectedDeviceId,
  onlineCount,
  onSelect,
  onBeep,
  onRename,
  onRemove,
  onShare,
}: Props) {
  const others = devices.filter((device) => device.deviceKey !== thisDeviceKey);

  return (
    <div className="card devices-card">
      <div className="card-header">
        <div>
          <h3>Computer Connessi</h3>
          <p>{onlineCount} attivi adesso</p>
        </div>
        <button className="primary-button small" onClick={onShare}>
          <Plus size={14} /> Collega altro PC
        </button>
      </div>

      <div className="device-list">
        {devices.map((device) => {
          const Icon = deviceIcon(device);
          const isThis = device.deviceKey === thisDeviceKey;
          const isSelected = selectedDeviceId === device.id;

          return (
            <div
              key={device.id}
              className={`device-row-interactive ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(device.id)}
            >
              <div className={`device-avatar ${deviceAccent(device)}`}>
                <Icon size={18} />
              </div>
              <div className="device-info-col">
                <strong>
                  {device.name}
                  {isThis && <span className="this-badge">Questo PC</span>}
                  {device.screenSharing === 1 && <span className="screen-badge">Schermo ON</span>}
                </strong>
                <small>
                  <span
                    className={`status-dot ${device.status === "online" ? "online" : "offline"}`}
                  />
                  {device.status === "online" ? "Online adesso" : device.status === "idle" ? "Inattivo" : "Offline"}{" "}
                  · {device.platform} ({device.browser})
                </small>
                <DeviceInfoLines device={device} />
              </div>
              <div className="device-action-col">
                {!isThis && (
                  <>
                    <button
                      className="mini-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onBeep(device);
                      }}
                      title="Fai suonare"
                    >
                      <Volume2 size={13} />
                    </button>
                    <button
                      className="mini-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRename(device);
                      }}
                      title="Rinomina dispositivo"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="mini-action-btn danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(device);
                      }}
                      title="Rimuovi dispositivo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {others.length === 0 && (
        <div className="connect-prompt">
          <p>Non hai ancora altri computer collegati.</p>
          <span>
            Apri il link condiviso su un secondo computer per vederlo apparire qui in tempo reale.
          </span>
          <button onClick={onShare} className="primary-button small">
            Copia URL per l’altro PC
          </button>
        </div>
      )}
    </div>
  );
}
