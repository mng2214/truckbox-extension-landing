import { api } from "./api";
import { auth } from "./auth";

type AuthResponse = { token: string };

// The backend (GoogleAuthClient) validates a Google ACCESS token: it calls
// tokeninfo?access_token=... and fetches userinfo with the bearer token — the
// same shape the Chrome extension sends. So the web login uses the GIS OAuth2
// token-client flow (access token), NOT the GIS credential/ID-token flow.
export async function exchangeGoogleAccessToken(accessToken: string): Promise<void> {
  const res = await api.post<AuthResponse>("/api/v1/auth/google", { googleToken: accessToken });
  auth.setToken(res.token);
}
