import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { oauthFlowState } from "@/lib/db/schema";
import { pushedAuthorizationRequest } from "@/lib/openfeed/par";
import { AUTHORIZATION_ENDPOINT, CLIENT_ID, REDIRECT_URI } from "@/lib/openfeed/config";

/**
 * Real top-level form POST from the "Add Bank" button (not a client-side fetch+redirect) —
 * openfeed rejects PAR calls carrying a browser Origin header, so this must run server-side,
 * and a 303 redirect is what actually sends the browser on to openfeed next.
 */
export async function POST() {
  const par = await pushedAuthorizationRequest(REDIRECT_URI);

  // par.expiresIn (~60s) is only how long the browser has to *reach* /auth with this
  // request_uri — the actual login+consent session at the bank runs longer than that once
  // started. This row just needs to outlive that whole process, so give it its own ~10 min
  // TTL rather than reusing the PAR's short redemption window.
  const now = new Date();
  const OAUTH_FLOW_STATE_TTL_MS = 10 * 60 * 1000;
  db.insert(oauthFlowState)
    .values({
      state: par.state,
      codeVerifier: par.codeVerifier,
      nonce: par.nonce,
      redirectUri: REDIRECT_URI,
      createdAt: now,
      expiresAt: new Date(now.getTime() + OAUTH_FLOW_STATE_TTL_MS),
    })
    .run();

  const authorizeUrl = new URL(AUTHORIZATION_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("request_uri", par.requestUri);

  return NextResponse.redirect(authorizeUrl, 303);
}
