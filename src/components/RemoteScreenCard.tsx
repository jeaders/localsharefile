"use client";

import { Maximize2, MousePointer2, Video } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ApiDevice } from "@/lib/client/types";
import type { ScreenShareState } from "@/hooks/useScreenShare";
import { VirtualKeyboard } from "@/components/VirtualKeyboard";

type Props = {
  screen: ScreenShareState;
  selectedDevice: ApiDevice | null;
  thisDeviceKey: string;
};

export function RemoteScreenCard({ screen, selectedDevice, thisDeviceKey }: Props) {
  const canCommand = Boolean(selectedDevice) && selectedDevice?.deviceKey !== thisDeviceKey;
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Gli elementi <video> vivono qui; lo hook WebRTC li usa per lo stream.
  useEffect(() => {
    screen.registerVideos(localVideoRef.current, remoteVideoRef.current);
  }, [screen, screen.isScreenSharing, screen.isViewingRemote]);

  return (
    <div className="card remote-card">
      <div className="card-header">
        <div>
          <div className="card-title-line">
            <h3>Schermo Reale (WebRTC)</h3>
            {screen.isScreenSharing && (
              <span className="live-pill">
                <i /> TRASMETTENDO
              </span>
            )}
            {screen.isViewingRemote && (
              <span className="live-pill">
                <i /> RICEVENDO
              </span>
            )}
          </div>
          <p>
            Cattura dello schermo del browser tramite <code>getDisplayMedia</code>.
          </p>
        </div>
      </div>

      {screen.screenError && (
        <div className="error-note">
          <span>{screen.screenError}</span>
        </div>
      )}

      <div className="video-viewport">
        {screen.isScreenSharing && (
          <div className="video-player-wrap">
            <span className="video-tag">Mio Schermo in Trasmissione</span>
            <video ref={localVideoRef} playsInline muted className="actual-video" />
          </div>
        )}

        {screen.isViewingRemote && (
          <div className={`video-player-wrap ${screen.isFullScreen ? "fullscreen-mode" : ""}`}>
            <span className="video-tag">
              Schermo Remoto Connesso
              {screen.isControllingRemote && (
                <span className="live-pill">
                  <i /> CONTROLLO ATTIVO
                </span>
              )}
              <button
                className="fullscreen-toggle"
                onClick={() => screen.setIsFullScreen(!screen.isFullScreen)}
                title={screen.isFullScreen ? "Esci dall’ingrandimento" : "Schermo intero"}
              >
                <Maximize2 size={16} />
              </button>
              <button
                className="fullscreen-toggle"
                onClick={screen.toggleRemoteControl}
                title={
                  screen.isControllingRemote
                    ? "Blocca il controllo remoto"
                    : "Controlla lo schermo remoto"
                }
                style={{ right: "50px" }}
              >
                <MousePointer2 size={16} />
              </button>
            </span>
            <video
              ref={remoteVideoRef}
              playsInline
              className="actual-video"
              onClick={screen.playRemoteVideo}
            />
            {screen.needsPlay && (
              <button className="video-play-overlay" onClick={screen.playRemoteVideo}>
                Clicca per riprodurre lo schermo
              </button>
            )}
            {screen.isControllingRemote && (
              <VirtualKeyboard onSend={screen.sendVirtualKey} />
            )}
          </div>
        )}

        {!screen.isScreenSharing && !screen.isViewingRemote && (
          <div className="video-placeholder">
            <Video size={36} />
            <strong>Nessuno schermo attivo in questo momento</strong>
            <span>
              Clicca su <b>&quot;Condividi Mio Schermo&quot;</b> per trasmettere il desktop di questo
              PC agli altri computer.
            </span>
            <div className="video-placeholder-actions">
              <button className="primary-button small" onClick={screen.startScreenShare}>
                <Video size={14} /> Condividi Mio Schermo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="remote-controls-box">
        <div className="helper-status-row">
          <span className={screen.nativeHelperUp ? "status-dot online" : "status-dot offline"} />
          <span>
            {screen.nativeHelperUp === null && "Verifica helper nativo…"}
            {screen.nativeHelperUp === true && "Helper nativo ATTIVO — mouse e tastiera reali"}
            {screen.nativeHelperUp === false &&
              "Helper nativo non attivo — controllo limitato alla pagina (avvia: npm run helper)"}
          </span>
        </div>
        <strong>
          Comandi Reali al computer selezionato:{" "}
          <em>{selectedDevice ? selectedDevice.name : "Nessuno"}</em>
        </strong>
        <div className="cmd-grid">
          <button
            className="cmd-btn"
            onClick={() => screen.sendCommand("beep")}
            disabled={!canCommand}
            title="Fa suonare un beep sul computer di destinazione"
          >
            Fai Suonare Beep
          </button>
          <button
            className="cmd-btn"
            onClick={() => {
              const message = window.prompt(
                "Messaggio da far comparire sull’altro PC:",
                "Controlla il file su NODO!",
              );
              if (message) screen.sendCommand("alert", message);
            }}
            disabled={!canCommand}
          >
            Invia Messaggio Pop-up
          </button>
          <button
            className="cmd-btn"
            onClick={() => {
              const url = window.prompt("URL da aprire nel browser dell’altro PC:", "https://github.com");
              if (url) screen.sendCommand("openUrl", url);
            }}
            disabled={!canCommand}
          >
            Apri Link sul suo Browser
          </button>
          <button
            className="cmd-btn"
            onClick={() => {
              const text = window.prompt(
                "Testo da copiare negli appunti dell’altro PC:",
                "Testo condiviso da NODO",
              );
              if (text) screen.sendCommand("clipboard", text);
            }}
            disabled={!canCommand}
          >
            Invia agli Appunti (Clipboard)
          </button>
        </div>
      </div>
    </div>
  );
}
