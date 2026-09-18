import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts, bankConnections, syncRuns, transactions } from "../db/schema";
import { decryptSecret, encryptSecret } from "../db/crypto";
import { refreshAccessToken } from "../openfeed/token";
import { listAccounts } from "../openfeed/accounts";
import { listTransactions } from "../openfeed/transactions";
import type { OpenfeedAccount, OpenfeedTransaction } from "../openfeed/types";

function toCents(amount: string | number | undefined | null): number | null {
  if (amount === undefined || amount === null) return null;
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function upsertAccount(connectionId: string, account: OpenfeedAccount, now: Date) {
  const balanceCurrent = toCents(account.balance?.current);
  const balanceAvailable = toCents(account.balance?.available);
  const shared = {
    displayName: account.displayName ?? null,
    accountType: account.accountType ?? null,
    productCategory: account.productCategory ?? null,
    productName: account.productName ?? null,
    maskedNumber: account.maskedNumber ?? null,
    status: account.status ?? null,
    currency: account.currency ?? null,
    balanceCurrent,
    balanceAvailable,
    balanceUpdatedAt: balanceCurrent !== null ? now : null,
    rawJson: JSON.stringify(account),
  };
  db.insert(accounts)
    .values({ id: account.accountId, connectionId, createdAt: now, updatedAt: now, ...shared })
    .onConflictDoUpdate({ target: accounts.id, set: { ...shared, updatedAt: now } })
    .run();
}

/** Returns true if this transaction was newly inserted (false if it already existed). */
function upsertTransaction(accountId: string, txn: OpenfeedTransaction, now: Date): boolean {
  const result = db
    .insert(transactions)
    .values({
      id: txn.transactionId,
      accountId,
      amount: toCents(txn.amount),
      currency: txn.currency ?? null,
      description: txn.description ?? null,
      merchantName: txn.merchantName ?? null,
      transactionType: txn.transactionType ?? null,
      merchantCategoryCode: txn.merchantCategoryCode ?? null,
      status: txn.status ?? null,
      postedAt: toDate(txn.postedDateTime),
      executedAt: toDate(txn.executionDateTime),
      rawJson: JSON.stringify(txn),
      createdAt: now,
    })
    .onConflictDoNothing({ target: transactions.id })
    .run();
  return result.changes > 0;
}

/** Seeds accounts (and only accounts — no transactions) right after a fresh consent, so the
 * new connection has something to show immediately; the caller already has a live access
 * token from the token exchange, so no refresh/decrypt round-trip is needed here. */
export function seedAccounts(connectionId: string, remoteAccounts: OpenfeedAccount[]) {
  const now = new Date();
  for (const account of remoteAccounts) upsertAccount(connectionId, account, now);
}

export interface SyncResult {
  connectionId: string;
  status: "success" | "error";
  accountsSynced: number;
  transactionsAdded: number;
  error?: string;
}

export type SyncTrigger = "manual-ui" | "mcp-tool" | "lazy";

/** Refreshes the access token, re-pulls accounts + all transactions, and upserts everything.
 * Called both from the "Sync Now" route and the MCP `sync_now` tool — SQLite is the only
 * thing either surface reads from directly. */
export async function syncConnection(
  connectionId: string,
  trigger: SyncTrigger = "manual-ui",
): Promise<SyncResult> {
  const startedAt = new Date();
  const connection = db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .get();

  if (!connection || !connection.refreshTokenEncrypted) {
    throw new Error(`connection ${connectionId} not found or has no refresh token`);
  }

  const { lastInsertRowid: syncRunId } = db
    .insert(syncRuns)
    .values({ connectionId, trigger, startedAt, status: "running" })
    .run();

  try {
    const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
    const tokens = await refreshAccessToken(refreshToken);

    const remoteAccounts = await listAccounts(tokens.access_token);
    const now = new Date();
    let transactionsAdded = 0;
    for (const account of remoteAccounts) {
      upsertAccount(connectionId, account, now);
      const remoteTxns = await listTransactions(tokens.access_token, account.accountId);
      for (const txn of remoteTxns) {
        if (upsertTransaction(account.accountId, txn, now)) transactionsAdded += 1;
      }
    }

    // openfeed may rotate the refresh token on use — persist the latest one if so.
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      db.update(bankConnections)
        .set({ refreshTokenEncrypted: encryptSecret(tokens.refresh_token) })
        .where(eq(bankConnections.id, connectionId))
        .run();
    }

    const finishedAt = new Date();
    db.update(bankConnections)
      .set({
        status: "active",
        lastSyncedAt: finishedAt,
        lastSyncStatus: "success",
        lastError: null,
        updatedAt: finishedAt,
      })
      .where(eq(bankConnections.id, connectionId))
      .run();
    db.update(syncRuns)
      .set({
        finishedAt,
        status: "success",
        accountsSynced: remoteAccounts.length,
        transactionsAdded,
      })
      .where(eq(syncRuns.id, syncRunId as number))
      .run();

    return {
      connectionId,
      status: "success",
      accountsSynced: remoteAccounts.length,
      transactionsAdded,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date();
    db.update(bankConnections)
      .set({
        status: "error",
        lastSyncedAt: finishedAt,
        lastSyncStatus: "error",
        lastError: message,
        updatedAt: finishedAt,
      })
      .where(eq(bankConnections.id, connectionId))
      .run();
    db.update(syncRuns)
      .set({ finishedAt, status: "error", errorMessage: message })
      .where(eq(syncRuns.id, syncRunId as number))
      .run();
    return { connectionId, status: "error", accountsSynced: 0, transactionsAdded: 0, error: message };
  }
}
