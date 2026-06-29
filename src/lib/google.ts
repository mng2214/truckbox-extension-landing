import { api } from "./api";
import { auth } from "./auth";

type AuthResponse = { token: string };

export async function exchangeGoogleAccessToken(accessToken: string): Promise<void> {
  const res = await api.post<AuthResponse>("/api/v1/auth/google", { googleToken: accessToken });
  auth.setToken(res.token);
}
