"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { DevicesSection } from "@/components/DevicesSection";
import { HelpSection } from "@/components/HelpSection";
import { OverviewSection } from "@/components/OverviewSection";
import { PairingGate } from "@/components/PairingGate";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/Toast";
import { Topbar } from "@/components/Topbar";
import { TransfersSection } from "@/components/TransfersSection";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useIdentity } from "@/hooks/useIdentity";
import { usePairing } from "@/hooks/usePairing";
import { usePresence } from "@/hooks/usePresence";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useServerInfo } from "@/hooks/useServerInfo";
import { useSharedState } from "@/hooks/useSharedState";
import { useSignals } from "@/hooks/useSignals";
import { useToast } from "@/hooks/useToast";
import { apiFetch, storedToken } from "@/lib/client/api";
import type { ApiDevice, RemoteCommand, Section } from "@/lib/client/types";

export default function HomePage() {
  const pairing = usePairing();
  const paired = pairing.status === "paired";

  const { deviceKey, customName, identity, displayName, renameThisDevice } = useIdentity();
  const serverInfo = useServerInfo(paired);
  const { devices, files, refresh } = useSharedState(paired && Boolean(deviceKey));
  const { toast, showToast, dismissToast } = useToast();

  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [receivedCommands, setReceivedCommands] = useState<RemoteCommand[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thisDevice = devices.find((device) => device.deviceKey === deviceKey) ?? null;
  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ??
    devices.find((device) => device.deviceKey !== deviceKey) ??
    thisDevice ??
    null;

  const onlineDevices = useMemo(
    () => devices.filter((device) => device.status === "online"),
    [devices],
  );

  const visibleDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      `${device.name} ${device.platform} ${device.browser}`.toLowerCase().includes(query),
    );
  }, [devices, search]);

  const handleCommandReceived = useCallback((command: RemoteCommand) => {
    setReceivedCommands((previous) => [command, ...previous].slice(0, 10));
  }, []);

  const screen = useScreenShare({
    thisDeviceKey: deviceKey,
    devices,
    selectedDevice,
    httpsUrl: serverInfo?.httpsUrl ?? "https://localhost:3443",
    showToast,
    onCommandReceived: handleCommandReceived,
  });

  useSignals({
    deviceKey,
    enabled: paired && Boolean(deviceKey),
    onSignal: screen.handleSignal,
  });

  usePresence({
    enabled: paired && Boolean(deviceKey),
    deviceKey,
    name: customName || displayName,
    identity,
    screenSharing: screen.isScreenSharing,
  });

  const { isUploading, uploadProgress, upload } = useFileUpload({
    uploaderName: thisDevice?.name ?? displayName,
    targetDeviceName:
      selectedDevice && selectedDevice.deviceKey !== deviceKey ? selectedDevice.name : null,
    onUploaded: refresh,
    showToast,
  });

  const copyShareLink = useCallback(async () => {
    const token = storedToken();
    const base = `${window.location.origin}/`;
    // Il link contiene il token: chi lo apre resta accoppiato a questo server.
    const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiato: contiene il token di accesso");
    } catch {
      showToast(`Indirizzo da aprire: ${url}`);
    }
  }, [showToast]);

  const handleRenameThisDevice = useCallback(() => {
    const next = window.prompt(
      "Scegli un nome riconoscibile per questo computer:",
      customName || displayName,
    );
    if (!next?.trim()) return;
    renameThisDevice(next);
    showToast(`Nome aggiornato: "${next.trim()}"`);
  }, [customName, displayName, renameThisDevice, showToast]);

  const handleRenameDevice = useCallback(
    async (device: ApiDevice) => {
      const next = window.prompt("Nuovo nome per questo dispositivo:", device.name);
      if (!next || next.trim() === device.name) return;
      try {
        const response = await apiFetch("/api/devices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: device.id, name: next.trim() }),
        });
        if (!response.ok) throw new Error("rinomina fallita");
        showToast("Dispositivo rinominato");
        await refresh();
      } catch {
        showToast("Errore durante la rinomina");
      }
    },
    [refresh, showToast],
  );

  const handleRemoveDevice = useCallback(
    async (device: ApiDevice) => {
      if (!window.confirm(`Rimuovere "${device.name}"? Tornerà se si ricollega.`)) return;
      try {
        const response = await apiFetch("/api/devices", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: device.id }),
        });
        if (!response.ok) throw new Error("rimozione fallita");
        showToast("Dispositivo rimosso");
        await refresh();
      } catch {
        showToast("Errore durante la rimozione");
      }
    },
    [refresh, showToast],
  );

  const handleBeepDevice = useCallback(
    (device: ApiDevice) => {
      void screen.sendCommandTo(device, "beep");
    },
    [screen],
  );

  const handleMessageDevice = useCallback(
    (device: ApiDevice) => {
      const message = window.prompt(`Messaggio da inviare a ${device.name}:`, "Ciao!");
      if (message) void screen.sendCommandTo(device, "alert", message);
    },
    [screen],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const count = await upload(event.target.files);
      event.target.value = "";
      if (count > 0) setSection("transfers");
    },
    [upload],
  );

  const handleDropFiles = useCallback(
    (fileList: FileList | null) => {
      void upload(fileList).then((count) => {
        if (count > 0) setSection("transfers");
      });
    },
    [upload],
  );

  if (pairing.status === "checking") {
    return (
      <div className="pairing-shell">
        <div className="pairing-card">
          <Loader2 size={26} className="pairing-spinner" />
          <h1>Connessione al server…</h1>
        </div>
      </div>
    );
  }

  if (pairing.status === "required") {
    return (
      <PairingGate error={pairing.error} submitting={pairing.submitting} onSubmit={pairing.submit} />
    );
  }

  const httpsUrl = serverInfo?.httpsUrl ?? "https://localhost:3443";
  const httpUrl = serverInfo
    ? `http://${serverInfo.primaryIp ?? "localhost"}:${serverInfo.httpPort}`
    : "http://localhost:3000";

  return (
    <div className="app-shell">
      <Sidebar
        activeSection={section}
        onSelectSection={setSection}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onlineCount={onlineDevices.length}
        sharedCount={files.length}
        deviceCount={devices.length}
        thisDevice={thisDevice}
        displayName={displayName}
        onRenameThisDevice={handleRenameThisDevice}
      />

      <main className="main-content">
        <Topbar
          section={section}
          commandCount={receivedCommands.length}
          onShare={copyShareLink}
          onShowCommands={() => showToast(`Hai ${receivedCommands.length} comandi recenti`)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div className="page-container">
          {section === "overview" && (
            <OverviewSection
              devices={devices}
              files={files}
              onlineDevices={onlineDevices}
              thisDeviceKey={deviceKey}
              selectedDevice={selectedDevice}
              selectedDeviceId={selectedDeviceId}
              screen={screen}
              serverInfo={serverInfo}
              receivedCommands={receivedCommands}
              onClearCommands={() => setReceivedCommands([])}
              onSelectDevice={setSelectedDeviceId}
              onBeepDevice={handleBeepDevice}
              onRenameDevice={handleRenameDevice}
              onRemoveDevice={handleRemoveDevice}
              onShare={copyShareLink}
              onUploadClick={handleUploadClick}
              onRefresh={refresh}
              showToast={showToast}
            />
          )}

          {section === "transfers" && (
            <TransfersSection
              files={files}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onUploadClick={handleUploadClick}
              onDropFiles={handleDropFiles}
              onRefresh={refresh}
              showToast={showToast}
            />
          )}

          {section === "devices" && (
            <DevicesSection
              devices={devices}
              visibleDevices={visibleDevices}
              thisDeviceKey={deviceKey}
              search={search}
              onSearchChange={setSearch}
              onShare={copyShareLink}
              onBeep={handleBeepDevice}
              onMessage={handleMessageDevice}
              onRenameThisDevice={handleRenameThisDevice}
            />
          )}

          {section === "network-help" && (
            <HelpSection
              httpsUrl={httpsUrl}
              httpUrl={httpUrl}
              currentOrigin={serverInfo?.currentOrigin ?? ""}
              onShare={copyShareLink}
            />
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden-input"
        onChange={(event) => void handleFileInput(event)}
      />

      <Toast message={toast} onClose={dismissToast} />
    </div>
  );
}
