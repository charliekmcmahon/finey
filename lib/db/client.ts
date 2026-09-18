import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { projectRoot } from "../root";

const DATA_DIR = path.join(projectRoot(), "data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "finey.db");

// Two separate OS processes (the Next.js dev server and the MCP stdio server) open this
// file concurrently — WAL mode is required so reads/writes don't lock each other out.
export const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
