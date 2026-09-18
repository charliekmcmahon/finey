export interface Envelope<T> {
  version?: string;
  data: T;
  meta?: Record<string, unknown>;
  links?: { self?: string; next?: string | null; prev?: string | null };
}

export interface TokenResponse {
  access_token: string;
  token_type: "DPoP" | "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * Shape confirmed against a real GET /v1/banking/accounts response (a Virgin Money credit
 * card). Note the primary key field is `accountId`, not `id`, and institution info
 * (providerId/providerName) is included directly — no separate lookup needed. No
 * currency/balance fields were present on this response; other account types (e.g.
 * transaction/savings) may include more — treat those as optional until confirmed.
 */
export interface OpenfeedAccount {
  accountId: string;
  providerId?: string;
  providerName?: string;
  displayName?: string;
  nickname?: string;
  accountType?: string | null;
  productCategory?: string;
  productName?: string;
  status?: string;
  maskedNumber?: string;
  accountOwnership?: string;
  creationDate?: string;
  isOwned?: boolean;
  currency?: string;
  [key: string]: unknown;
}

/** Shape confirmed against a real GET /v1/banking/accounts/{id}/balance response — balance
 * is NOT included on the accounts list at all; it's a separate per-account call. */
export interface OpenfeedBalance {
  accountId: string;
  currency?: string;
  currentBalance?: string | number;
  availableBalance?: string | number;
  creditLimit?: string | number | null;
  amortisedLimitAmount?: string | number | null;
  [key: string]: unknown;
}

/** Shape confirmed against a real GET /v1/banking/accounts/{id}/transactions response.
 * Primary key is `transactionId`, not `id`. There's no `category` field — the closest
 * things are `transactionType` (e.g. "PAYMENT") and `merchantCategoryCode` (a raw MCC
 * number, not a friendly category name). `postedDateTime` is null for PENDING transactions. */
export interface OpenfeedTransaction {
  transactionId: string;
  accountId?: string;
  amount?: string | number;
  currency?: string;
  description?: string;
  merchantName?: string | null;
  transactionType?: string;
  merchantCategoryCode?: string | null;
  status?: string;
  transactionDate?: string | null;
  valueDate?: string | null;
  postedDateTime?: string | null;
  executionDateTime?: string | null;
  billerCode?: string | null;
  billerName?: string | null;
  apcaNumber?: string | null;
  reference?: string;
  [key: string]: unknown;
}
