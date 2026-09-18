import { API_BASE } from "./config";
import { authorizedJson } from "./api";
import type { Envelope, OpenfeedAccount } from "./types";

export async function listAccounts(accessToken: string): Promise<OpenfeedAccount[]> {
  const results: OpenfeedAccount[] = [];
  let url: string | undefined = `${API_BASE}/v1/banking/accounts`;
  while (url) {
    const page: Envelope<OpenfeedAccount[]> = await authorizedJson(
      "GET",
      url,
      accessToken,
    );
    results.push(...page.data);
    url = page.links?.next ?? undefined;
  }
  return results;
}
