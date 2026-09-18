import { API_BASE } from "./config";
import { authorizedJson } from "./api";
import type { Envelope, OpenfeedBalance } from "./types";

/** Balance is not included on GET /v1/banking/accounts — it's a separate per-account call. */
export async function getAccountBalance(
  accessToken: string,
  accountId: string,
): Promise<OpenfeedBalance> {
  const envelope: Envelope<OpenfeedBalance> = await authorizedJson(
    "GET",
    `${API_BASE}/v1/banking/accounts/${accountId}/balance`,
    accessToken,
  );
  return envelope.data;
}
