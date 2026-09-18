import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { bankConnections } from "./db/schema";
import { decryptSecret } from "./db/crypto";
import { revokeRefreshToken } from "./openfeed/token";

/** Withdraws consent at the bank (best-effort — consent may already be revoked
 * out-of-band) and deletes the connection; accounts/transactions/sync_runs cascade. */
export async function unlinkConnection(connectionId: string): Promise<void> {
  const connection = db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .get();
  if (connection?.refreshTokenEncrypted) {
    try {
      await revokeRefreshToken(decryptSecret(connection.refreshTokenEncrypted));
    } catch (err) {
      console.error(`revoke failed for connection ${connectionId}:`, err);
    }
  }
  db.delete(bankConnections).where(eq(bankConnections.id, connectionId)).run();
}
