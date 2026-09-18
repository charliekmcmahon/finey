import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../../lib/db/client";
import { bankConnections } from "../../lib/db/schema";
import { syncConnection } from "../../lib/sync/engine";

export function registerSyncNow(server: McpServer) {
  server.registerTool(
    "sync_now",
    {
      title: "Sync now",
      description:
        "Forces a fresh pull from the bank (bypassing the cache staleness window) for one " +
        "connection, or all connections if none specified. Blocks until done — can take a " +
        "few seconds per connection.",
      inputSchema: {
        connectionId: z.string().optional().describe("Sync only this connection; omit to sync all"),
      },
    },
    async ({ connectionId }) => {
      const ids = connectionId
        ? [connectionId]
        : db.select({ id: bankConnections.id }).from(bankConnections).all().map((c) => c.id);

      const results = [];
      for (const id of ids) {
        results.push(await syncConnection(id, "mcp-tool"));
      }

      return { content: [{ type: "text" as const, text: JSON.stringify({ results }, null, 2) }] };
    },
  );
}
