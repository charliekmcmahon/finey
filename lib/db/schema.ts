import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const bankConnections = sqliteTable("bank_connections", {
  id: text("id").primaryKey(),
  providerId: text("provider_id"),
  providerName: text("provider_name"),
  /** pending | active | error | revoked */
  status: text("status").notNull().default("pending"),
  grantId: text("grant_id"),
  scope: text("scope"),
  dpopKeyRef: text("dpop_key_ref").notNull().default("default"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  consentExpiresAt: integer("consent_expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastSyncStatus: text("last_sync_status"),
  lastError: text("last_error"),
});

/** Short-lived rows bridging the PAR->redirect->callback hop (server-side PKCE/state storage). */
export const oauthFlowState = sqliteTable("oauth_flow_state", {
  state: text("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  nonce: text("nonce").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const accounts = sqliteTable("accounts", {
  /** openfeed accountId */
  id: text("id").primaryKey(),
  connectionId: text("connection_id")
    .notNull()
    .references(() => bankConnections.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  accountType: text("account_type"),
  productCategory: text("product_category"),
  productName: text("product_name"),
  maskedNumber: text("masked_number"),
  status: text("status"),
  currency: text("currency"),
  /** integer cents; nullable since not every account type has a balance on record */
  balanceCurrent: integer("balance_current"),
  balanceAvailable: integer("balance_available"),
  balanceUpdatedAt: integer("balance_updated_at", { mode: "timestamp" }),
  rawJson: text("raw_json"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    /** openfeed transaction id — the dedupe key across repeated syncs */
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: integer("amount"),
    currency: text("currency"),
    description: text("description"),
    merchantName: text("merchant_name"),
    transactionType: text("transaction_type"),
    merchantCategoryCode: text("merchant_category_code"),
    status: text("status"),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    /** high-water mark for incremental sync */
    executedAt: integer("executed_at", { mode: "timestamp" }),
    rawJson: text("raw_json"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("transactions_account_executed_idx").on(table.accountId, table.executedAt)],
);

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  connectionId: text("connection_id")
    .notNull()
    .references(() => bankConnections.id, { onDelete: "cascade" }),
  /** manual-ui | mcp-tool | lazy */
  trigger: text("trigger").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  /** running | success | error */
  status: text("status").notNull(),
  accountsSynced: integer("accounts_synced").default(0),
  transactionsAdded: integer("transactions_added").default(0),
  errorMessage: text("error_message"),
});
