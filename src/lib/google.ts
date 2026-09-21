import { api } from "./api";
import { auth } from "./auth";

export type GoogleAuthResult = {
  token: string;
  email: string;
  phoneVerificationRequired: boolean;
};

export async function exchangeGoogleAccessToken(
  accessToken: string,
  signup = false,
): Promise<GoogleAuthResult> {
  const res = await api.post<GoogleAuthResult>("/api/v1/auth/google", {
    googleToken: accessToken,
    ...(signup ? { signup: true } : {}),
  });
  auth.setToken(res.token);
  return res;
}
