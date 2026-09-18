# Finey

A personal finance dashboard + MCP server for bank accounts linked via
[openfeed](https://openfeed.au) (Australian Consumer Data Right / open banking data).

- **Web app** (Next.js + shadcn/ui): link banks, view balances/transactions, manage syncs.
- **MCP server**: exposes the same cached data as tools so Claude can query your accounts
  and transactions directly.
- **SQLite** (via Drizzle): local cache, source of truth for both surfaces. Refresh tokens
  are AES-256-GCM encrypted at rest; access tokens are never persisted.

## One-time setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `TOKEN_ENCRYPTION_KEY` (see the command in
   that file).
3. The `secrets/` folder holds the openfeed client-auth key (`finey_client_key.pem`) and
   DPoP key (`finey_dpop_key.default.json`) — gitignored, never commit these.
4. **On the openfeed dashboard**, the Finey app (client id
   `app-dc4ef1f0-367f-4a37-b30e-a3f5d3ac3224`) must have
   `http://localhost:3000/api/auth/callback` registered as an allowed redirect URI. The
   dev server must run on port 3000 to match.
5. `npm run db:migrate` — creates `data/finey.db` (WAL mode; gitignored).

## Running

```bash
npm run dev          # web app at http://localhost:3000
npm run mcp           # MCP server (stdio) — normally launched by Claude Code via .mcp.json, not run by hand
```

To link a bank: go to **Connections → Add bank**. This does a real 303 redirect to
openfeed for login/consent (not a client-side fetch — openfeed rejects PAR/token calls
that carry a browser `Origin`, so the whole OAuth exchange happens server-side). Repeat
for each bank; each one becomes its own `bank_connections` row with its own refresh token.

## Syncing

Cache-first: pages and MCP tools read straight from SQLite. Balances/accounts are
considered stale after 30 minutes, transactions after 4 hours — a stale read triggers a
non-blocking background resync. "Sync now" (UI button or the `sync_now` MCP tool) always
forces a fresh pull. Transactions are deduped by openfeed's transaction id, so re-syncing
is always safe.

## MCP tools

`list_bank_connections`, `list_accounts`, `get_balances`, `get_transactions` (filters:
account/connection, date range, amount range, text search), `sync_now`. See
`mcp/tools/*.ts` for exact schemas.

## Useful scripts

- `npm run oauth:spike` — standalone end-to-end OAuth test (PAR → browser consent →
  token exchange → prints real `GET /v1/banking/accounts` data), independent of the DB/UI.
  Useful for debugging the openfeed integration in isolation.
- `npm run db:generate` — generate a Drizzle migration after editing `lib/db/schema.ts`.
- `npm run typecheck`

## Notes on the openfeed API (learned empirically, not fully documented)

- Account primary key is `accountId`, not `id`; transaction primary key is
  `transactionId`, not `id`. Institution name/id (`providerName`/`providerId`) are
  included directly on each account — no separate lookup needed.
- Transactions have no `category` field — closest equivalents are `transactionType`
  (e.g. `PAYMENT`) and `merchantCategoryCode` (a raw MCC number).
- Only `openid`, `offline_access`, and `openfeed-au:data:banking:read` scopes are enabled
  for this app registration — requesting the `grant:self:*` scopes fails with
  `invalid_scope`.
- Access tokens last 1 hour (`expires_in: 3600`); `offline_access` yields a refresh token.
