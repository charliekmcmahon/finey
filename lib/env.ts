import path from "node:path";
import { projectRoot } from "./root";

/**
 * Next.js loads `.env.local` on its own; standalone entrypoints (the MCP server, CLI
 * scripts run via tsx) don't get that for free, so they import this module first.
 */
const envPath = path.join(projectRoot(), ".env.local");
try {
  process.loadEnvFile(envPath);
} catch {
  // missing .env.local is fine in contexts (like Next.js) that already loaded env another way
}
