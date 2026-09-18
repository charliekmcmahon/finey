/**
 * Generates the two keypairs Finey needs for the openfeed FAPI 2.0 flow:
 *   - a client-auth key (RSA-2048, PS256), used to sign private_key_jwt client assertions
 *   - a DPoP key (RSA-2048, PS256), used to sign DPoP proofs
 *
 * Run once when setting up a fresh openfeed app registration:
 *   npx tsx scripts/generate-keys.ts
 *
 * Writes into secrets/ (gitignored) and prints the JWKS document to paste into the
 * openfeed dashboard. Refuses to overwrite an existing key so it can't clobber a working
 * setup by accident; delete the old files first if you really want to rotate.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, exportPKCS8, exportSPKI, type JWK } from "jose";
import { projectRoot } from "../lib/root";

const SECRETS_DIR = path.join(projectRoot(), "secrets");

async function main() {
  mkdirSync(SECRETS_DIR, { recursive: true });

  const clientKeyPath = path.join(SECRETS_DIR, "finey_client_key.pem");
  if (existsSync(clientKeyPath)) {
    console.error(`${clientKeyPath} already exists, refusing to overwrite. Delete it first if you want to rotate keys.`);
    process.exit(1);
  }

  const kid = `finey-${randomUUID().slice(0, 8)}`;

  const clientKeyPair = await generateKeyPair("PS256", { extractable: true, modulusLength: 2048 });
  const clientPrivatePem = await exportPKCS8(clientKeyPair.privateKey);
  const clientPublicPem = await exportSPKI(clientKeyPair.publicKey);
  const clientPublicJwk: JWK = await exportJWK(clientKeyPair.publicKey);
  clientPublicJwk.kid = kid;
  clientPublicJwk.alg = "PS256";
  clientPublicJwk.use = "sig";

  writeFileSync(clientKeyPath, clientPrivatePem, { mode: 0o600 });
  writeFileSync(path.join(SECRETS_DIR, "finey_client_key_public.pem"), clientPublicPem);
  const jwks = { keys: [clientPublicJwk] };
  writeFileSync(path.join(SECRETS_DIR, "finey_client_jwks.json"), JSON.stringify(jwks, null, 2));

  const dpopKeyPair = await generateKeyPair("PS256", { extractable: true, modulusLength: 2048 });
  const dpopPrivateJwk = await exportJWK(dpopKeyPair.privateKey);
  writeFileSync(
    path.join(SECRETS_DIR, "finey_dpop_key.default.json"),
    JSON.stringify(dpopPrivateJwk),
    { mode: 0o600 },
  );

  console.log(`Generated keys with kid: ${kid}\n`);
  console.log(`Set KID in lib/openfeed/config.ts to "${kid}".\n`);
  console.log("Paste this JWKS into the openfeed dashboard's app registration");
  console.log("(Public key source: inline JWKS):\n");
  console.log(JSON.stringify(jwks, null, 2));
}

main();
