import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "./src/db";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
  `);
  return result.rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
  `);
  return result.rows.length > 0;
}

async function ensureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      device_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'Computer',
      platform TEXT NOT NULL DEFAULT 'Sconosciuto',
      browser TEXT NOT NULL DEFAULT 'Browser',
      address TEXT,
      local_ip TEXT,
      mac_address TEXT,
      user_agent TEXT,
      screen_sharing INTEGER NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      uploaded_by TEXT NOT NULL,
      target_device TEXT,
      storage_path TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY,
      from_device_key TEXT NOT NULL,
      to_device_key TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // Colonne aggiunte nel tempo a tabelle già esistenti.
  const deviceColumns: [string, string][] = [
    ["kind", "TEXT NOT NULL DEFAULT 'Computer'"],
    ["platform", "TEXT NOT NULL DEFAULT 'Sconosciuto'"],
    ["browser", "TEXT NOT NULL DEFAULT 'Browser'"],
    ["address", "TEXT"],
    ["local_ip", "TEXT"],
    ["mac_address", "TEXT"],
    ["user_agent", "TEXT"],
    ["screen_sharing", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [column, definition] of deviceColumns) {
    if (!(await columnExists("devices", column))) {
      await db.execute(sql.raw(`ALTER TABLE devices ADD COLUMN ${column} ${definition}`));
      console.log(`[db] aggiunta colonna devices.${column}`);
    }
  }

  const fileColumns: [string, string][] = [
    ["mime_type", "TEXT NOT NULL DEFAULT 'application/octet-stream'"],
    ["target_device", "TEXT"],
    ["storage_path", "TEXT"],
  ];
  for (const [column, definition] of fileColumns) {
    if (!(await columnExists("files", column))) {
      await db.execute(sql.raw(`ALTER TABLE files ADD COLUMN ${column} ${definition}`));
      console.log(`[db] aggiunta colonna files.${column}`);
    }
  }
}

async function ensureIndexes(): Promise<void> {
  const statements = [
    "CREATE INDEX IF NOT EXISTS devices_last_seen_idx ON devices (last_seen_at)",
    "CREATE INDEX IF NOT EXISTS files_created_at_idx ON files (created_at)",
    "CREATE INDEX IF NOT EXISTS signals_target_idx ON signals (to_device_key, id)",
    "CREATE INDEX IF NOT EXISTS signals_created_at_idx ON signals (created_at)",
  ];
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
  console.log("[db] indici pronti");
}

/**
 * Sposta i contenuti binari salvati in files.content su data/uploads e poi
 * elimina la colonna: il DB resta leggero e i download possono usare lo
 * streaming dal disco.
 */
async function migrateContentToDisk(): Promise<void> {
  if (!(await columnExists("files", "content"))) {
    console.log("[db] colonna files.content già assente: niente da migrare");
    return;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ids = await db.execute(sql`SELECT id FROM files WHERE content IS NOT NULL ORDER BY id`);
  console.log(`[db] file con contenuto nel DB da spostare su disco: ${ids.rows.length}`);

  let written = 0;
  let failed = 0;

  for (const row of ids.rows as { id: number }[]) {
    const detail = await db.execute(
      sql`SELECT file_name, storage_path, content FROM files WHERE id = ${row.id}`,
    );
    const record = detail.rows[0] as
      | { file_name: string; storage_path: string | null; content: Buffer | null }
      | undefined;
    if (!record?.content) continue;

    const fileName =
      record.storage_path || `${row.id}-${record.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      await writeFile(join(UPLOAD_DIR, fileName), record.content);
      await db.execute(sql`UPDATE files SET storage_path = ${fileName} WHERE id = ${row.id}`);
      written += 1;
      console.log(`[db] id=${row.id} → data/uploads/${fileName} (${record.content.length} byte)`);
    } catch (error) {
      failed += 1;
      console.error(`[db] id=${row.id} non copiato:`, error);
    }
  }

  if (failed > 0) {
    console.error(
      `[db] ${failed} file non copiati: la colonna content NON verrà eliminata. Risolvi e rilancia npm run db:migrate.`,
    );
    return;
  }

  await db.execute(sql`ALTER TABLE files DROP COLUMN content`);
  console.log(`[db] colonna files.content eliminata (${written} file spostati su disco)`);
}

async function main(): Promise<void> {
  await db.execute(sql`select 1`);
  console.log("[db] connessione OK");

  if (!(await tableExists("devices"))) console.log("[db] creo la tabella devices");
  await ensureTables();
  await ensureIndexes();
  await migrateContentToDisk();

  console.log("[db] schema pronto");
  console.log("[db] token di accesso: data/nodo-token (oppure NODO_TOKEN)");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[db] migrazione fallita:", error);
    await pool.end().catch(() => {});
    process.exit(1);
  });
