import { dpopProof } from "./jwt";

/**
 * Calls an openfeed resource-server endpoint with a DPoP-bound access token, attaching a
 * fresh per-request DPoP proof (with the `ath` claim). Retries once if the server responds
 * with a `DPoP-Nonce` challenge (RFC 9449 §8), per the same pattern used at the token endpoint.
 */
export async function authorizedFetch(
  method: string,
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const attempt = async (nonce?: string) => {
    const dpop = await dpopProof(method, url, { accessToken, nonce });
    return fetch(url, {
      ...init,
      method,
      headers: {
        ...init.headers,
        Authorization: `DPoP ${accessToken}`,
        DPoP: dpop,
      },
    });
  };

  let res = await attempt();
  if ((res.status === 400 || res.status === 401) && res.headers.get("DPoP-Nonce")) {
    res = await attempt(res.headers.get("DPoP-Nonce")!);
  }
  return res;
}

export async function authorizedJson<T>(
  method: string,
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await authorizedFetch(method, url, accessToken, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openfeed API call failed: ${res.status} ${res.statusText} — ${text}`);
  }
  return (await res.json()) as T;
}
