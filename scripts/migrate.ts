import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "../lib/db/client";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
sqlite.close();
