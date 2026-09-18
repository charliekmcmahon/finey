import {
  PAR_ENDPOINT,
  CLIENT_ID,
  CLIENT_ASSERTION_TYPE,
  SCOPES,
} from "./config";
import { clientAssertion, dpopProof, pkcePair, randomState, randomNonce } from "./jwt";

export interface ParResult {
  requestUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresIn: number;
}

/**
 * Pushed Authorization Request (RFC 9126) — required by openfeed before the browser
 * can be sent to the authorization endpoint. Must be a plain server-to-server POST
 * (openfeed rejects calls that carry a browser `Origin` header for private_key_jwt clients).
 */
export async function pushedAuthorizationRequest(
  redirectUri: string,
): Promise<ParResult> {
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  const nonce = randomNonce();

  const body = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    nonce,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: await clientAssertion(),
  });

  const dpop = await dpopProof("POST", PAR_ENDPOINT);

  const res = await fetch(PAR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpop,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PAR failed: ${res.status} ${res.statusText} — ${text}`);
  }

  const json = (await res.json()) as { request_uri: string; expires_in: number };
  return {
    requestUri: json.request_uri,
    expiresIn: json.expires_in,
    state,
    nonce,
    codeVerifier: verifier,
  };
}
