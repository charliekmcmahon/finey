import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { accounts, bankConnections } from "../../lib/db/schema";

export function registerListAccounts(server: McpServer) {
  server.registerTool(
    "list_accounts",
    {
      title: "List accounts",
      description:
        "Lists bank accounts (with current balances) from the local cache, optionally " +
        "filtered to one connection. Balances are in dollars, not cents.",
      inputSchema: {
        connectionId: z
          .string()
          .optional()
          .describe("Only list accounts for this bank connection id"),
      },
    },
    async ({ connectionId }) => {
      const rows = connectionId
        ? db.select().from(accounts).where(eq(accounts.connectionId, connectionId)).all()
        : db.select().from(accounts).all();

      const connectionIds = [...new Set(rows.map((a) => a.connectionId))];
      const connectionRows = connectionIds.length
        ? db.select().from(bankConnections).where(inArray(bankConnections.id, connectionIds)).all()
        : [];
      const connectionById = new Map(connectionRows.map((c) => [c.id, c]));

      const result = rows.map((a) => ({
        id: a.id,
        connectionId: a.connectionId,
        institutionName: connectionById.get(a.connectionId)?.providerName ?? null,
        displayName: a.displayName,
        accountType: a.accountType,
        productCategory: a.productCategory,
        productName: a.productName,
        maskedNumber: a.maskedNumber,
        currency: a.currency,
        balanceCurrent: a.balanceCurrent !== null ? a.balanceCurrent / 100 : null,
        balanceAvailable: a.balanceAvailable !== null ? a.balanceAvailable / 100 : null,
        balanceUpdatedAt: a.balanceUpdatedAt?.toISOString() ?? null,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
