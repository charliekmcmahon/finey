import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { desc, sql } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { accounts, bankConnections } from "../../lib/db/schema";

export function registerListBankConnections(server: McpServer) {
  server.registerTool(
    "list_bank_connections",
    {
      title: "List bank connections",
      description:
        "Lists all linked bank connections with status, last sync time, last error, and " +
        "account count. Use this to see what banks are connected and whether any need attention.",
      inputSchema: {},
    },
    async () => {
      const connectionRows = db
        .select()
        .from(bankConnections)
        .orderBy(desc(bankConnections.createdAt))
        .all();

      const counts = db
        .select({ connectionId: accounts.connectionId, count: sql<number>`count(*)` })
        .from(accounts)
        .groupBy(accounts.connectionId)
        .all();
      const countByConnection = new Map(counts.map((c) => [c.connectionId, c.count]));

      const result = connectionRows.map((c) => ({
        id: c.id,
        institutionName: c.providerName,
        status: c.status,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        lastSyncStatus: c.lastSyncStatus,
        lastError: c.lastError,
        consentExpiresAt: c.consentExpiresAt?.toISOString() ?? null,
        accountCount: countByConnection.get(c.id) ?? 0,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
