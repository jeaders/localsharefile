import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { filePathFor } from "@/lib/queries";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Download in streaming: il file non viene mai caricato interamente in memoria. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAuth(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const fileId = Number.parseInt(id, 10);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return new Response("ID non valido", { status: 400 });
    }

    const [fileMeta] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!fileMeta) {
      return new Response("File non trovato", { status: 404 });
    }

    const fullPath = filePathFor(fileMeta.storagePath);
    const info = await stat(fullPath).catch(() => null);
    if (!info?.isFile()) {
      return new Response(
        "Il contenuto di questo file non è presente su questo server. Caricalo di nuovo per condividerlo.",
        { status: 404 },
      );
    }

    const nodeStream = createReadStream(fullPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": fileMeta.mimeType,
        "Content-Disposition": contentDisposition(fileMeta.fileName),
        "Content-Length": String(info.size),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Errore download file:", error);
    return new Response("File non disponibile", { status: 500 });
  }
}
