import { useEffect, useRef } from "react";
import { exchangeGoogleIdToken } from "../lib/google";

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google || !ref.current || !id) return;
    window.google.accounts.id.initialize({
      client_id: id,
      callback: async (resp: { credential: string }) => {
        await exchangeGoogleIdToken(resp.credential);
        onSignedIn();
      },
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
    });
  }, [onSignedIn]);
  return <div ref={ref} />;
}
