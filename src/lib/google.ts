import { api } from "./api";
import { auth } from "./auth";

export type GoogleAuthResult = {
  token: string;
  email: string;
  phoneVerificationRequired: boolean;
};

export async function exchangeGoogleAccessToken(accessToken: string): Promise<GoogleAuthResult> {
  const res = await api.post<GoogleAuthResult>("/api/v1/auth/google", { googleToken: accessToken });
  auth.setToken(res.token);
  return res;
}
