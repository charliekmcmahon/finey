import { randomBytes, randomUUID, createHash } from "node:crypto";
import { SignJWT } from "jose";
import { ISSUER, CLIENT_ID, KID } from "./config";
import { clientKey, dpopKey, dpopPublicKey } from "./keys";

/** Signs a `private_key_jwt` client assertion proving we hold the client's private key. */
export async function clientAssertion(aud: string = ISSUER): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: CLIENT_ID,
    sub: CLIENT_ID,
    aud,
    jti: randomUUID(),
    iat: now,
    exp: now + 60,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "PS256", kid: KID })
    .sign(await clientKey());
}

interface DPoPOptions {
  /** Access token this proof will accompany — adds the `ath` claim (RFC 9449 §4.2). */
  accessToken?: string;
  /** Server-issued DPoP-Nonce to echo back, when retrying after a 400 that requested one. */
  nonce?: string;
}

/** Signs a DPoP proof JWT for a specific HTTP method + URL (and optionally a bound access token). */
export async function dpopProof(
  htm: string,
  htu: string,
  opts: DPoPOptions = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    jti: randomUUID(),
    htm,
    htu,
    iat: now,
  };
  if (opts.accessToken) {
    claims.ath = createHash("sha256")
      .update(opts.accessToken)
      .digest()
      .toString("base64url");
  }
  if (opts.nonce) {
    claims.nonce = opts.nonce;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "PS256", jwk: dpopPublicKey() })
    .sign(await dpopKey());
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** Generates a PKCE code_verifier/code_challenge pair (S256). */
export function pkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest()
    .toString("base64url");
  return { verifier, challenge };
}

export function randomState(): string {
  return randomBytes(16).toString("base64url");
}

export function randomNonce(): string {
  return randomBytes(16).toString("base64url");
}
