import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { accounts, transactions } from "../../lib/db/schema";

export function registerGetTransactions(server: McpServer) {
  server.registerTool(
    "get_transactions",
    {
      title: "Get transactions",
      description:
        "Queries cached transactions with optional filters. Amounts are in dollars (not " +
        "cents); negative means money out. This reads the local cache — call sync_now first " +
        "if you need guaranteed-fresh data.",
      inputSchema: {
        accountId: z.string().optional().describe("Filter to a single account id"),
        connectionId: z
          .string()
          .optional()
          .describe("Filter to all accounts under this bank connection"),
        startDate: z
          .string()
          .optional()
          .describe("ISO date, inclusive lower bound on the transaction's executed date"),
        endDate: z
          .string()
          .optional()
          .describe("ISO date, inclusive upper bound on the transaction's executed date"),
        minAmount: z.number().optional().describe("In dollars, inclusive lower bound (can be negative)"),
        maxAmount: z.number().optional().describe("In dollars, inclusive upper bound (can be negative)"),
        search: z
          .string()
          .optional()
          .describe("Case-insensitive substring match on description or merchant name"),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ accountId, connectionId, startDate, endDate, minAmount, maxAmount, search, limit, offset }) => {
      const conditions: SQL[] = [];
      if (accountId) conditions.push(eq(transactions.accountId, accountId));
      if (connectionId) {
        const ids = db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.connectionId, connectionId))
          .all()
          .map((a) => a.id);
        conditions.push(ids.length ? inArray(transactions.accountId, ids) : sql`0`);
      }
      if (startDate) conditions.push(gte(transactions.executedAt, new Date(startDate)));
      if (endDate) conditions.push(lte(transactions.executedAt, new Date(endDate)));
      if (minAmount !== undefined) conditions.push(gte(transactions.amount, Math.round(minAmount * 100)));
      if (maxAmount !== undefined) conditions.push(lte(transactions.amount, Math.round(maxAmount * 100)));
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          sql`(${transactions.description} LIKE ${pattern} OR ${transactions.merchantName} LIKE ${pattern})`,
        );
      }

      const rows = db
        .select()
        .from(transactions)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(transactions.executedAt))
        .limit(limit)
        .offset(offset)
        .all();

      const result = rows.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        amount: t.amount !== null ? t.amount / 100 : null,
        currency: t.currency,
        description: t.description,
        merchantName: t.merchantName,
        transactionType: t.transactionType,
        status: t.status,
        postedAt: t.postedAt?.toISOString() ?? null,
        executedAt: t.executedAt?.toISOString() ?? null,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ transactions: result, count: result.length, limit, offset }, null, 2),
          },
        ],
      };
    },
  );
}
