import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { inArray } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { accounts, bankConnections } from "../../lib/db/schema";
import { syncConnection } from "../../lib/sync/engine";

const BALANCE_STALE_MS = 30 * 60 * 1000;

export function registerGetBalances(server: McpServer) {
  server.registerTool(
    "get_balances",
    {
      title: "Get account balances",
      description:
        "Returns current balances for accounts (all accounts if none specified) from the " +
        "local cache, in dollars. If a connection hasn't synced in the last 30 minutes this " +
        "also kicks off a background refresh — call again shortly after for updated figures " +
        "(each result's `stale` flag says whether that happened).",
      inputSchema: {
        accountIds: z
          .array(z.string())
          .optional()
          .describe("Specific account ids to fetch balances for; omit for all accounts"),
      },
    },
    async ({ accountIds }) => {
      const rows = accountIds?.length
        ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
        : db.select().from(accounts).all();

      const connectionIds = [...new Set(rows.map((a) => a.connectionId))];
      const connectionRows = connectionIds.length
        ? db.select().from(bankConnections).where(inArray(bankConnections.id, connectionIds)).all()
        : [];
      const connectionById = new Map(connectionRows.map((c) => [c.id, c]));

      const now = Date.now();
      for (const connection of connectionRows) {
        const lastSynced = connection.lastSyncedAt?.getTime() ?? 0;
        if (now - lastSynced > BALANCE_STALE_MS) {
          syncConnection(connection.id, "lazy").catch((err) => {
            console.error(`lazy sync failed for connection ${connection.id}:`, err);
          });
        }
      }

      const result = rows.map((a) => {
        const connection = connectionById.get(a.connectionId);
        const lastSynced = connection?.lastSyncedAt?.getTime() ?? 0;
        return {
          accountId: a.id,
          institutionName: connection?.providerName ?? null,
          displayName: a.displayName,
          currency: a.currency,
          balanceCurrent: a.balanceCurrent !== null ? a.balanceCurrent / 100 : null,
          balanceAvailable: a.balanceAvailable !== null ? a.balanceAvailable / 100 : null,
          asOf: a.balanceUpdatedAt?.toISOString() ?? null,
          stale: now - lastSynced > BALANCE_STALE_MS,
        };
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
