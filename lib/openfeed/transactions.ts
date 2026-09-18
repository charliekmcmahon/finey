import { API_BASE } from "./config";
import { authorizedJson } from "./api";
import type { Envelope, OpenfeedTransaction } from "./types";

export async function listTransactions(
  accessToken: string,
  accountId: string,
): Promise<OpenfeedTransaction[]> {
  const results: OpenfeedTransaction[] = [];
  let url: string | undefined = `${API_BASE}/v1/banking/accounts/${accountId}/transactions`;
  while (url) {
    const page: Envelope<OpenfeedTransaction[]> = await authorizedJson(
      "GET",
      url,
      accessToken,
    );
    results.push(...page.data);
    url = page.links?.next ?? undefined;
  }
  return results;
}
