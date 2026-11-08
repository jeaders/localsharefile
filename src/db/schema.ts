import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Registro condiviso dei dispositivi
export const devices = pgTable(
  "devices",
  {
    id: serial("id").primaryKey(),
    deviceKey: text("device_key").notNull().unique(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("Computer"),
    platform: text("platform").notNull().default("Sconosciuto"),
    browser: text("browser").notNull().default("Browser"),
    address: text("address"), // IP pubblico/locale rilevato dal server
    localIp: text("local_ip"), // IP locale del dispositivo (es. 192.168.x.x)
    macAddress: text("mac_address"), // MAC address (se disponibile)
    userAgent: text("user_agent"), // User agent completo
    screenSharing: integer("screen_sharing").notNull().default(0), // 1 = sta condividendo lo schermo
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("devices_last_seen_idx").on(table.lastSeenAt)],
);

// Indice dei file condivisi: il contenuto vive su disco (data/uploads),
// qui restano solo i metadati.
export const files = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    uploadedBy: text("uploaded_by").notNull(),
    targetDevice: text("target_device"), // opzionale: se indirizzato a uno specifico
    storagePath: text("storage_path").notNull(), // nome del file dentro data/uploads
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("files_created_at_idx").on(table.createdAt)],
);

// Messaggi di segnalazione WebRTC e comandi tra dispositivi
export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    fromDeviceKey: text("from_device_key").notNull(),
    toDeviceKey: text("to_device_key").notNull(),
    type: text("type").notNull(), // 'offer', 'answer', 'candidate', 'cmd'
    payload: text("payload").notNull(), // JSON string
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("signals_target_idx").on(table.toDeviceKey, table.id),
    index("signals_created_at_idx").on(table.createdAt),
  ],
);
