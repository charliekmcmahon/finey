export const CLIENT_ID = "app-dc4ef1f0-367f-4a37-b30e-a3f5d3ac3224";
export const KID = "finey-b22edbbd";

export const ISSUER = "https://auth.openfeed.au";
export const AUTHORIZATION_ENDPOINT = "https://auth.openfeed.au/auth";
export const PAR_ENDPOINT = "https://auth.openfeed.au/request";
export const TOKEN_ENDPOINT = "https://auth.openfeed.au/token";
export const REVOCATION_ENDPOINT = "https://auth.openfeed.au/token/revocation";
export const GRANT_MANAGEMENT_ENDPOINT = "https://api.openfeed.au/v1/grants";
export const API_BASE = "https://api.openfeed.au";

// Only scopes actually enabled on the openfeed dashboard for this app (banking-only;
// energy was left unchecked). grant:self:query/revoke were listed in the original
// client_info.json but the live server rejects them with invalid_scope — the app
// registration apparently doesn't have them enabled. Revisit if that's turned on later.
export const SCOPES = ["openid", "offline_access", "openfeed-au:data:banking:read"].join(
  " ",
);

export const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

// Pinned to match exactly what's registered on the openfeed dashboard for this app.
// The Next.js dev server must run on this exact port (`next dev -p 3000`).
export const REDIRECT_URI = "http://localhost:3000/api/auth/callback";
