"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/client/api";

type Options = {
  uploaderName: string;
  targetDeviceName: string | null;
  onUploaded: () => Promise<void> | void;
  showToast: (message: string) => void;
};

export function useFileUpload({ uploaderName, targetDeviceName, onUploaded, showToast }: Options) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const upload = useCallback(
    async (fileList: FileList | null): Promise<number> => {
      if (!fileList || fileList.length === 0) return 0;

      setIsUploading(true);
      setUploadProgress(`Caricamento di ${fileList.length} file...`);
      let uploaded = 0;

      try {
        for (let index = 0; index < fileList.length; index += 1) {
          const file = fileList[index];
          setUploadProgress(`Invio: ${file.name} (${index + 1}/${fileList.length})`);

          const formData = new FormData();
          formData.append("file", file);
          formData.append("uploadedBy", uploaderName);
          if (targetDeviceName) formData.append("targetDevice", targetDeviceName);

          const response = await apiFetch("/api/files", { method: "POST", body: formData });
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? `Upload fallito per ${file.name}`);
          }
          uploaded += 1;
        }

        showToast(`${uploaded} file caricati e disponibili per tutti i computer`);
        await onUploaded();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Errore durante il caricamento";
        showToast(message);
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }

      return uploaded;
    },
    [onUploaded, showToast, targetDeviceName, uploaderName],
  );

  return { isUploading, uploadProgress, upload };
}
