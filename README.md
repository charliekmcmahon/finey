# Finey

Finey is a personal finance dashboard and MCP server for bank accounts linked through
[openfeed](https://openfeed.au), an Australian Consumer Data Right (open banking) data
aggregator. It has three parts:

- **Web app** (Next.js + shadcn/ui): link bank accounts, view balances and transactions,
  manage syncs.
- **MCP server**: exposes the same cached data as tools, so Claude (or any MCP client) can
  query your accounts and transactions directly.
- **SQLite database** (via Drizzle): the local cache and source of truth for both the web
  app and the MCP server. Refresh tokens are encrypted at rest (AES-256-GCM); access tokens
  are never persisted.

This document explains both how to run an existing checkout and how to set the whole thing
up from scratch against your own openfeed developer account.

## How it works

openfeed uses FAPI 2.0: Pushed Authorization Requests (PAR), PKCE, `private_key_jwt` client
authentication (no client secret, just a signed JWT), and DPoP-bound access tokens (RFC
9449, proof-of-possession tokens instead of plain bearer tokens). None of the PAR or token
exchange calls can happen from a browser: openfeed rejects them if they carry a browser
`Origin` header, since a `private_key_jwt` client's private key must never reach a page.
That is why the whole OAuth exchange runs server-side, in Next.js route handlers, with only
the login and consent screen happening in the user's browser.

The flow, in order:

1. **PAR**: the server POSTs to openfeed's `/request` endpoint with a signed client
   assertion and a DPoP proof, and gets back a short-lived `request_uri`.
2. **Authorize**: the user's browser is redirected to openfeed's `/auth` endpoint with that
   `request_uri`. They log in to their bank and consent to sharing data.
3. **Callback**: openfeed redirects back to the app's registered redirect URI with an
   authorization code.
4. **Token exchange**: the server exchanges the code for a DPoP-bound access token and a
   refresh token, again with a signed client assertion and a DPoP proof.
5. **API calls**: every call to `GET /v1/banking/accounts`, `GET
   /v1/banking/accounts/{id}/balance`, and `GET /v1/banking/accounts/{id}/transactions`
   carries a fresh, per-request DPoP proof.

## Prerequisites

- Node.js 22 or newer (uses `node:crypto`'s `randomUUID`/`randomBytes`, native `fetch`, and
  `process.loadEnvFile`).
- An openfeed developer account and a registered app. If you do not have one, sign up at
  [app.openfeed.au](https://app.openfeed.au) and register a new app (see below).
- A Mac, Linux, or Windows machine with normal outbound internet access. openfeed rejects
  calls proxied through a restrictive network sandbox, so this will not work from an
  environment with locked-down egress.

## Setting up from scratch

### 1. Register an app on openfeed

In the openfeed dashboard, register a new app with:

- **Auth method**: `private_key_jwt` (no client secret).
- **Scopes**: `openid`, `offline_access`, and `openfeed-au:data:banking:read`. Leave the
  energy scope unchecked unless you need it.
- **Public key source**: inline JWKS (you will paste this in step 3, after generating keys).
- **Redirect URI**: `http://localhost:3000/api/auth/callback`. The dev server has to run on
  port 3000 to match this exactly.

Note the app's **client ID** (looks like `app-<uuid>`) once it is registered.

### 2. Clone and install

```bash
git clone <this-repo> finey
cd finey
npm install
```

### 3. Generate keys

```bash
npm run generate:keys
```

This creates, in a gitignored `secrets/` folder:

- `finey_client_key.pem`: the private client-authentication key (RSA-2048, PS256). Signs
  the `private_key_jwt` client assertions.
- `finey_client_key_public.pem`: its public half.
- `finey_client_jwks.json`: the public key as a JWKS document.
- `finey_dpop_key.default.json`: a private DPoP key (RSA-2048, PS256). Signs DPoP proofs.

The script prints a `kid` and a JWKS document. Paste the JWKS into the openfeed dashboard's
"Public key (JWKS)" field for your app, then open `lib/openfeed/config.ts` and set:

```ts
export const CLIENT_ID = "app-<your app id>";
export const KID = "finey-<the kid the script printed>";
```

### 4. Set up the encryption key

```bash
cp .env.example .env.local
```

Then generate a 32-byte key and put it in `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```
TOKEN_ENCRYPTION_KEY=<paste the output here>
```

This key encrypts refresh tokens at rest. Losing it means every linked bank has to be
re-linked; do not commit it.

### 5. Create the database

```bash
npm run db:migrate
```

This creates `data/finey.db` (SQLite, WAL mode, gitignored).

### 6. Prove the OAuth flow works, in isolation

Before touching the web app, run the standalone spike script. It does the full PAR, browser
consent, token exchange, and a real `GET /v1/banking/accounts` call, with no database or UI
involved:

```bash
npm run oauth:spike
```

It prints a URL. Open it in your own browser, log in to a bank, and consent. The script
catches the redirect on `localhost:3000` automatically and prints your real account data if
everything is wired up correctly. This is the fastest way to debug key, scope, or redirect
URI problems before layering the rest of the app on top.

## Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Connections > Add bank**.
This submits a real HTML form POST to `/api/auth/start` (not a client-side fetch, for the
reason explained above), which redirects your browser to openfeed. Log in and consent, and
you land back on the connection's detail page with accounts and balances populated.

Repeat for each bank you want to link. Each one becomes its own row in `bank_connections`
with its own encrypted refresh token.

## Syncing and caching

Reads are cache-first: both the web app's pages and the MCP tools read straight from
SQLite, never live from openfeed on every request. A background sync keeps that cache
fresh:

- Balances and account details are considered stale after 30 minutes.
- Transactions are considered stale after 4 hours.
- A stale read triggers a non-blocking background resync (stale-while-revalidate): you get
  the cached data immediately, and the next read picks up whatever the background sync
  found.
- "Sync now" (the UI button, or the `sync_now` MCP tool) always forces an immediate,
  blocking resync regardless of staleness.

Transactions are deduplicated by openfeed's transaction ID, so re-syncing the same period
repeatedly is always safe and idempotent.

## Using the MCP server

The MCP server (`mcp/server.ts`) runs over stdio and exposes five tools:
`list_bank_connections`, `list_accounts`, `get_balances`, `get_transactions`, and
`sync_now`. See `mcp/tools/*.ts` for exact input schemas.

### Claude Code

A project-level `.mcp.json` is already checked in. Open Claude Code with this repository as
the working directory and the `finey` server connects automatically.

### Claude Desktop

Claude Desktop's MCP configuration format does not support a working-directory field, so
the server needs an absolute path to its entry script and an explicit environment variable
telling it where the project lives. In Settings > Developer > Edit Config, add:

```json
{
  "mcpServers": {
    "finey": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/finey/mcp/server.ts"],
      "env": {
        "FINEY_PROJECT_ROOT": "/absolute/path/to/finey"
      }
    }
  }
}
```

Restart Claude Desktop after saving. If you see `Cannot find module '/mcp/server.ts'` in
the logs, the config is missing one of these two fixes; see `lib/root.ts` for how path
resolution works.

## Project structure

```
finey/
  app/                      Next.js App Router pages and API routes
    api/auth/start           starts the OAuth flow (PAR, redirect to openfeed)
    api/auth/callback        handles the redirect back, exchanges the code
    api/connections          list, sync, and unlink bank connections
    connections/, accounts/  the dashboard pages
  components/                shadcn/ui primitives plus app-specific components
  lib/
    openfeed/                 the FAPI 2.0 client: JWT signing, PAR, token exchange,
                              DPoP proofs, and typed API wrappers
    db/                       Drizzle schema, SQLite client, token encryption
    sync/engine.ts             the cache-first sync engine shared by the web app and MCP
    root.ts                   resolves the project root reliably across run contexts
  mcp/
    server.ts                  MCP entrypoint (stdio transport)
    tools/                     one file per MCP tool
  scripts/
    generate-keys.ts           one-time key generation for a fresh app registration
    oauth-spike.ts              standalone end-to-end OAuth test
    migrate.ts                  applies Drizzle migrations
  secrets/                    gitignored: client-auth key, DPoP key, JWKS
  data/                       gitignored: the SQLite database
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web app at `http://localhost:3000`. |
| `npm run mcp` | Start the MCP server directly (normally launched by an MCP client instead). |
| `npm run generate:keys` | Generate a fresh client-auth key and DPoP key. |
| `npm run oauth:spike` | Standalone end-to-end OAuth test, independent of the database and UI. |
| `npm run db:generate` | Generate a Drizzle migration after editing `lib/db/schema.ts`. |
| `npm run db:migrate` | Apply migrations, creating `data/finey.db` if needed. |
| `npm run typecheck` | Run `tsc --noEmit`. |

## Notes on the openfeed API

Some of this was not obvious from documentation and was only confirmed by making real
calls:

- The account list (`GET /v1/banking/accounts`) does not include balances at all. Balance
  is a separate call, `GET /v1/banking/accounts/{id}/balance`, returning
  `currentBalance`, `availableBalance`, `creditLimit`, and `currency`.
- An account's primary key field is `accountId`, not `id`. A transaction's primary key
  field is `transactionId`, not `id`.
- Institution name and ID (`providerName` / `providerId`) are included directly on each
  account. No separate institution lookup is needed. Different accounts under the same
  connection can report different provider names.
- Transactions have no `category` field. The closest equivalents are `transactionType`
  (for example `PAYMENT`, `TRANSFER_INCOMING`) and `merchantCategoryCode` (a raw MCC
  number, not a friendly category name).
- Access tokens last one hour (`expires_in: 3600`). `offline_access` yields a refresh
  token, and in testing that refresh token was not rotated on use (the same value kept
  working across repeated refresh calls).
- Re-consenting to the same institution can invalidate the previous grant's refresh token
  (it starts failing with `invalid_grant`), even though the two grants may not cover the
  same set of accounts. The sync engine detects this, marks the connection `error`, and
  records the failure in `sync_runs`; you then need to unlink and re-add that bank.
- Only the scopes actually enabled on your app registration will be accepted. Requesting
  a scope that exists in the discovery document but is not enabled for your app (for
  example a `grant:self:*` scope) fails with `invalid_scope`, not a silently ignored
  request.

## Security notes

- Only refresh tokens are ever written to disk, and only encrypted (AES-256-GCM, key in
  `.env.local`, never in the database). Access tokens are short-lived and never persisted.
- The client-auth and DPoP private keys live as plain files under `secrets/`, gitignored,
  never logged.
- `.gitignore` covers `.env.local`, `secrets/`, and `data/` (including the SQLite WAL and
  SHM sidecar files). Check `git status` before your first commit rather than trusting the
  ignore file blindly.
- "Unlink" calls openfeed's revocation endpoint so consent is actually withdrawn at the
  bank, not just deleted locally.
- The dev server binds to localhost only. It has no authentication of its own by design
  (a personal, single-user tool), so it must never be exposed to a network or reverse
  proxied publicly.

## Troubleshooting

**"Bad Request" when opening the consent link.** The PAR `request_uri` is short-lived
(around 60 seconds). If more than a minute passes between generating the link and opening
it, generate a fresh one and open it immediately.

**PAR fails with `invalid_scope`.** You are requesting a scope your app registration does
not have enabled. Check the scopes checked on the openfeed dashboard against
`SCOPES` in `lib/openfeed/config.ts`.

**Token exchange fails with `invalid_grant` on a previously working connection.** The
refresh token has been invalidated, most often by re-consenting to the same institution
from a different connection. Unlink the broken connection and add it again.

**MCP server logs `Cannot find module '/mcp/server.ts'`.** The client that launched it did
not set a working directory. Use an absolute path in the `args` and set
`FINEY_PROJECT_ROOT` in `env`, as shown in the Claude Desktop section above.

**"Sync now" or a background sync fails after linking a new bank.** Check
`bank_connections.last_error` (or the connection detail page in the UI, or the
`list_bank_connections` MCP tool) for the underlying openfeed error message before
assuming it is a bug in Finey.
