"use client";

import { Download, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { formatFileSize, formatRelativeTime, getFileIcon } from "@/lib/client/format";
import type { SharedFile } from "@/lib/client/types";

type Props = {
  files: SharedFile[];
  onRefresh: () => void;
  showToast: (message: string) => void;
};

export function FilesTable({ files, onRefresh, showToast }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleDelete = async (file: SharedFile) => {
    if (
      !window.confirm(
        `Eliminare "${file.fileName}"? Il file viene rimosso anche dal disco del server.`,
      )
    ) {
      return;
    }

    setBusyId(file.id);
    try {
      const response = await apiFetch(`/api/files?id=${file.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("eliminazione fallita");
      showToast("File eliminato");
      onRefresh();
    } catch {
      showToast("Errore durante l’eliminazione");
    } finally {
      setBusyId(null);
    }
  };

  if (files.length === 0) {
    return (
      <div className="empty-files-box">
        <UploadCloud size={36} />
        <strong>Nessun file presente</strong>
        <p>Carica un file per renderlo scaricabile dagli altri computer collegati.</p>
      </div>
    );
  }

  return (
    <div className="real-files-table">
      <div className="files-head">
        <span>Nome File</span>
        <span>Caricato Da</span>
        <span>Dimensione</span>
        <span>Data</span>
        <span>Azione</span>
      </div>
      {files.map((file) => {
        const Icon = getFileIcon(file.mimeType, file.fileName);
        return (
          <div key={file.id} className="files-row">
            <div className="file-col-name">
              <div className="file-type-icon">
                <Icon size={16} />
              </div>
              <div className="file-name-stack">
                <strong>{file.fileName}</strong>
                {!file.available && (
                  <span
                    className="file-badge file-badge-warn"
                    title="Il contenuto non è presente su questo server: caricalo di nuovo"
                  >
                    Contenuto mancante — ricarica
                  </span>
                )}
              </div>
            </div>
            <div className="file-col-meta">
              <span>{file.uploadedBy}</span>
            </div>
            <div className="file-col-size">{formatFileSize(file.fileSize)}</div>
            <div className="file-col-time">{formatRelativeTime(file.createdAt)}</div>
            <div className="file-col-action">
              <div className="file-actions">
                {file.available && (
                  <a
                    href={`/api/files/${file.id}`}
                    download={file.fileName}
                    className="download-file-btn"
                    title="Scarica questo file"
                  >
                    <Download size={14} /> Scarica
                  </a>
                )}
                <button
                  onClick={() => void handleDelete(file)}
                  disabled={busyId === file.id}
                  className="download-file-btn delete-file-btn"
                  title="Elimina il file dal server"
                >
                  <Trash2 size={14} /> Elimina
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
