import { readFileSync } from "node:fs";
import path from "node:path";
import { importPKCS8, importJWK, type JWK } from "jose";
import { KID } from "./config";
import { projectRoot } from "../root";

const SECRETS_DIR = path.join(projectRoot(), "secrets");

interface DPoPJwk extends JWK {
  d: string;
  n: string;
  e: string;
  kty: "RSA";
}

let clientKeyPromise: Promise<CryptoKey> | null = null;
let dpopKeyPromise: Promise<CryptoKey> | null = null;
let dpopPublicJwk: JWK | null = null;

export function clientKey(): Promise<CryptoKey> {
  if (!clientKeyPromise) {
    const pem = readFileSync(
      path.join(SECRETS_DIR, "finey_client_key.pem"),
      "utf8",
    );
    clientKeyPromise = importPKCS8(pem, "PS256");
  }
  return clientKeyPromise;
}

export function clientKeyId(): string {
  return KID;
}

function loadDpopJwk(): DPoPJwk {
  const raw = readFileSync(
    path.join(SECRETS_DIR, "finey_dpop_key.default.json"),
    "utf8",
  );
  return JSON.parse(raw) as DPoPJwk;
}

export async function dpopKey(): Promise<CryptoKey> {
  if (!dpopKeyPromise) {
    const jwk = loadDpopJwk();
    dpopKeyPromise = importJWK(jwk, "PS256").then((key) => key as CryptoKey);
  }
  return dpopKeyPromise;
}

/** Public half of the DPoP key, suitable for embedding in a DPoP proof's `jwk` header. */
export function dpopPublicKey(): JWK {
  if (!dpopPublicJwk) {
    const { kty, n, e } = loadDpopJwk();
    dpopPublicJwk = { kty, n, e };
  }
  return dpopPublicJwk;
}
