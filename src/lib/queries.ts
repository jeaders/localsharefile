import { existsSync } from "node:fs";
import { join } from "node:path";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { devices, files } from "@/db/schema";
import { getDeviceStatus, type DeviceStatus } from "@/lib/devices";

export const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

const statusRank: Record<DeviceStatus, number> = { online: 0, idle: 1, offline: 2 };

export type DevicePayload = {
  id: number;
  deviceKey: string;
  name: string;
  kind: string;
  platform: string;
  browser: string;
  address: string | null;
  localIp: string | null;
  macAddress: string | null;
  userAgent: string | null;
  screenSharing: number;
  status: DeviceStatus;
  lastSeenAt: Date;
  createdAt: Date;
};

export type FilePayload = {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  targetDevice: string | null;
  createdAt: Date;
  /** false se il contenuto non è presente su questo server (file caricato altrove) */
  available: boolean;
};

export async function listDevices(): Promise<DevicePayload[]> {
  const rows = await db.select().from(devices).orderBy(asc(devices.name));
  const now = Date.now();
  return rows
    .map((device) => ({ ...device, status: getDeviceStatus(device.lastSeenAt, now) }))
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] || a.name.localeCompare(b.name),
    );
}

export async function listFiles(): Promise<FilePayload[]> {
  const rows = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      fileSize: files.fileSize,
      mimeType: files.mimeType,
      uploadedBy: files.uploadedBy,
      targetDevice: files.targetDevice,
      storagePath: files.storagePath,
      createdAt: files.createdAt,
    })
    .from(files)
    .orderBy(desc(files.createdAt));

  return rows.map(({ storagePath, ...file }) => ({
    ...file,
    available: Boolean(storagePath) && existsSync(join(UPLOAD_DIR, storagePath)),
  }));
}

export function filePathFor(storagePath: string): string {
  // Il nome è già sanificato in fase di upload, ma evitiamo comunque traversal.
  const safe = storagePath.replace(/[\\/]/g, "_");
  return join(UPLOAD_DIR, safe);
}
