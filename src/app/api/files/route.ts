import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { publishDevicesChanged } from "@/lib/bus";
import { UPLOAD_DIR, filePathFor, listFiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = Number(process.env.NODO_MAX_UPLOAD_MB ?? 2048) * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 120) || "file";
}

/** Indice dei file condivisi (i contenuti stanno su disco). */
export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    return Response.json({ files: await listFiles() });
  } catch (error) {
    console.error("Errore fetch files:", error);
    return Response.json({ files: [], error: "Errore recupero file" }, { status: 500 });
  }
}

/** Upload: il file viene scritto in streaming su data/uploads, in DB solo i metadati. */
export async function POST(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  let storagePath: string | null = null;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json(
        { error: "Caricamento troppo grande o non valido" },
        { status: 413 },
      );
    }

    const uploadedBy = (formData.get("uploadedBy") as string) || "Sconosciuto";
    const targetDevice = (formData.get("targetDevice") as string) || null;
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return Response.json({ error: "Nessun file fornito" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `File troppo grande: il limite è ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
        },
        { status: 413 },
      );
    }

    const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    const fullPath = filePathFor(safeName);

    await pipeline(
      Readable.fromWeb(file.stream() as unknown as NodeWebReadableStream<Uint8Array>),
      createWriteStream(fullPath),
    );
    storagePath = safeName;

    const [saved] = await db
      .insert(files)
      .values({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedBy,
        targetDevice,
        storagePath: safeName,
      })
      .returning();

    publishDevicesChanged("files");

    return Response.json({ ok: true, file: saved }, { status: 201 });
  } catch (error) {
    // Nessun file orfano se il salvataggio nel DB fallisce.
    if (storagePath) {
      await unlink(filePathFor(storagePath)).catch(() => {});
    }
    console.error("Errore upload file:", error);
    return Response.json({ error: "Upload fallito" }, { status: 500 });
  }
}

/** Elimina il file dalla lista E dal disco. */
export async function DELETE(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const id = Number.parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "ID non valido" }, { status: 400 });
    }

    const [removed] = await db
      .delete(files)
      .where(eq(files.id, id))
      .returning({ storagePath: files.storagePath });

    if (!removed) {
      return Response.json({ error: "File non trovato" }, { status: 404 });
    }

    if (removed.storagePath) {
      await unlink(join(UPLOAD_DIR, removed.storagePath)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          console.warn("[NODO] Impossibile eliminare il file dal disco:", error.message);
        }
      });
    }

    publishDevicesChanged("files");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Errore eliminazione file:", error);
    return Response.json({ error: "Eliminazione fallita" }, { status: 500 });
  }
}
