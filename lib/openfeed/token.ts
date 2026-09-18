import { TOKEN_ENDPOINT, REVOCATION_ENDPOINT, CLIENT_ID, CLIENT_ASSERTION_TYPE } from "./config";
import { clientAssertion, dpopProof } from "./jwt";
import type { TokenResponse } from "./types";

/**
 * POSTs to the token endpoint, retrying exactly once if openfeed responds 400 with a
 * `DPoP-Nonce` header — the DPoP proof must be rebuilt with that nonce and resent
 * (FAPI 2.0 / RFC 9449 server-issued nonce challenge).
 */
async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const attempt = async (nonce?: string) => {
    const dpop = await dpopProof("POST", TOKEN_ENDPOINT, { nonce });
    return fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        DPoP: dpop,
      },
      body: new URLSearchParams(params),
    });
  };

  let res = await attempt();
  if (res.status === 400) {
    const nonce = res.headers.get("DPoP-Nonce");
    if (nonce) {
      res = await attempt(nonce);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed: ${res.status} ${res.statusText} — ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    code: opts.code,
    code_verifier: opts.codeVerifier,
    redirect_uri: opts.redirectUri,
    client_id: CLIENT_ID,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: await clientAssertion(),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: await clientAssertion(),
  });
}

/** Withdraws consent at the bank so "Unlink" is a real revoke, not just a local delete. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const dpop = await dpopProof("POST", REVOCATION_ENDPOINT);
  const res = await fetch(REVOCATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", DPoP: dpop },
    body: new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: CLIENT_ID,
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: await clientAssertion(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revocation failed: ${res.status} ${res.statusText} — ${text}`);
  }
}
