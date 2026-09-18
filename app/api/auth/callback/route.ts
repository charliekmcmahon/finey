import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections, oauthFlowState } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/db/crypto";
import { exchangeCode } from "@/lib/openfeed/token";
import { listAccounts } from "@/lib/openfeed/accounts";
import { seedAccounts } from "@/lib/sync/engine";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? "";
    return errorPage(`openfeed returned an error: ${error}`, description);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return errorPage("Missing code or state on callback.");
  }

  // Look up + delete in one go — this row is the CSRF/replay guard: a missing or expired
  // state means this callback doesn't correspond to a flow we started (or it's been reused).
  const flow = db.select().from(oauthFlowState).where(eq(oauthFlowState.state, state)).get();
  if (flow) {
    db.delete(oauthFlowState).where(eq(oauthFlowState.state, state)).run();
  }
  if (!flow || flow.expiresAt.getTime() < Date.now()) {
    return errorPage("This link has expired or was already used — try connecting again.");
  }

  let tokens;
  try {
    tokens = await exchangeCode({
      code,
      codeVerifier: flow.codeVerifier,
      redirectUri: flow.redirectUri,
    });
  } catch (err) {
    return errorPage("Token exchange failed.", err instanceof Error ? err.message : String(err));
  }

  if (!tokens.refresh_token) {
    return errorPage(
      "openfeed didn't return a refresh token — check the offline_access scope was granted.",
    );
  }

  let remoteAccounts;
  try {
    remoteAccounts = await listAccounts(tokens.access_token);
  } catch (err) {
    return errorPage(
      "Connected, but the first accounts fetch failed.",
      err instanceof Error ? err.message : String(err),
    );
  }

  const connectionId = randomUUID();
  const now = new Date();
  const first = remoteAccounts[0];
  db.insert(bankConnections)
    .values({
      id: connectionId,
      providerId: first?.providerId ?? null,
      providerName: first?.providerName ?? null,
      status: "active",
      scope: tokens.scope ?? null,
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      lastSyncStatus: "success",
    })
    .run();

  seedAccounts(connectionId, remoteAccounts);

  return NextResponse.redirect(new URL(`/connections/${connectionId}`, url.origin), 303);
}

function errorPage(title: string, detail?: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Finey — connection failed</title>` +
      `<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">` +
      `<h1>${escapeHtml(title)}</h1>` +
      (detail ? `<p style="color:#666">${escapeHtml(detail)}</p>` : "") +
      `<p><a href="/connections">Back to connections</a></p></body>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
