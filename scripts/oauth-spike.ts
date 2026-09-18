/**
 * Standalone end-to-end test of the openfeed OAuth flow (PAR -> browser consent ->
 * callback -> token exchange -> GET /v1/banking/accounts), with zero DB/UI/MCP code
 * in the loop. Run with `npm run oauth:spike`.
 *
 * Prerequisite: http://localhost:3000/api/auth/callback must be registered as an
 * allowed redirect URI for the Finey app on the openfeed dashboard.
 */
import { createServer } from "node:http";
import { pushedAuthorizationRequest } from "../lib/openfeed/par";
import { exchangeCode } from "../lib/openfeed/token";
import { listAccounts } from "../lib/openfeed/accounts";
import { AUTHORIZATION_ENDPOINT, CLIENT_ID } from "../lib/openfeed/config";

const REDIRECT_URI = "http://localhost:3000/api/auth/callback";
const PORT = 3000;
const CALLBACK_PATH = "/api/auth/callback";

async function main() {
  console.log("Requesting PAR from openfeed...");
  const par = await pushedAuthorizationRequest(REDIRECT_URI);
  console.log(`Got request_uri (expires in ${par.expiresIn}s)`);

  const authorizeUrl = new URL(AUTHORIZATION_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("request_uri", par.requestUri);

  console.log("\nOpen this URL in your own browser, log in to your bank, and consent:\n");
  console.log(authorizeUrl.toString());
  console.log(`\nWaiting for the redirect back to ${REDIRECT_URI} ...\n`);

  const { code, state } = await waitForCallback(PORT, CALLBACK_PATH);

  if (state !== par.state) {
    throw new Error("state mismatch on callback — possible CSRF or stale request, aborting");
  }

  console.log("Got authorization code, exchanging for tokens...");
  const tokens = await exchangeCode({
    code,
    codeVerifier: par.codeVerifier,
    redirectUri: REDIRECT_URI,
  });
  console.log(
    `Got access_token (type=${tokens.token_type}, expires_in=${tokens.expires_in}s, ` +
      `has refresh_token=${Boolean(tokens.refresh_token)})`,
  );

  console.log("\nCalling GET /v1/banking/accounts ...\n");
  const accounts = await listAccounts(tokens.access_token);
  console.log(JSON.stringify(accounts, null, 2));
  console.log(`\n${accounts.length} account(s) returned. Spike succeeded.`);
}

function waitForCallback(
  port: number,
  path: string,
): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get("error");
      if (error) {
        res
          .writeHead(200, { "Content-Type": "text/html" })
          .end(`<h1>Error: ${error}</h1><p>${url.searchParams.get("error_description") ?? ""}</p>`);
        server.close();
        reject(
          new Error(
            `openfeed returned error: ${error} — ${url.searchParams.get("error_description")}`,
          ),
        );
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        res.writeHead(400).end("missing code or state");
        return;
      }
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<h1>Finey connected</h1><p>You can close this tab and go back to the terminal.</p>");
      server.close();
      resolve({ code, state });
    });
    server.listen(port);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
