import { useEffect, useRef, useState } from "react";
import { exchangeGoogleIdToken } from "../lib/google";

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google || !ref.current || !id) return;
    window.google.accounts.id.initialize({
      client_id: id,
      callback: async (resp: { credential: string }) => {
        try {
          await exchangeGoogleIdToken(resp.credential);
          onSignedIn();
        } catch (err) {
          console.error("Google sign-in exchange failed:", err);
          setError("Sign-in failed. Please try again.");
        }
      },
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
    });
  }, [onSignedIn]);
  return (
    <div>
      <div ref={ref} />
      {error && (
        <p style={{ color: "var(--danger, #c0392b)", marginTop: "0.5rem", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
