"use client";

import { ArrowLeftRight, UploadCloud } from "lucide-react";
import type { SharedFile } from "@/lib/client/types";
import { FilesTable } from "@/components/FilesTable";

type Props = {
  files: SharedFile[];
  isUploading: boolean;
  uploadProgress: string | null;
  onUploadClick: () => void;
  onDropFiles: (files: FileList | null) => void;
  onRefresh: () => void;
  showToast: (message: string) => void;
};

export function TransfersSection({
  files,
  isUploading,
  uploadProgress,
  onUploadClick,
  onDropFiles,
  onRefresh,
  showToast,
}: Props) {
  return (
    <section className="page-section">
      <div className="section-page-heading">
        <div>
          <div className="eyebrow">
            <ArrowLeftRight size={14} /> SCAMBIO REALE
          </div>
          <h1>File Condivisi tra i PC</h1>
          <p>
            I file caricati sono memorizzati sul server e scaricabili da qualsiasi altro computer.
          </p>
        </div>
        <button className="primary-button" onClick={onUploadClick} disabled={isUploading}>
          <UploadCloud size={17} /> {isUploading ? "Caricamento..." : "Carica File"}
        </button>
      </div>

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropFiles(event.dataTransfer.files);
        }}
        onClick={onUploadClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onUploadClick();
        }}
      >
        <UploadCloud size={32} />
        <strong>Trascina qui i tuoi file</strong>
        <span>oppure clicca per selezionare dal disco (PDF, immagini, video, ZIP…)</span>
        {uploadProgress && <div className="upload-progress-tag">{uploadProgress}</div>}
      </div>

      <div className="full-table-card card">
        <FilesTable files={files} onRefresh={onRefresh} showToast={showToast} />
      </div>
    </section>
  );
}
