import { useEffect } from "react";

const IMG = "/dat-example.jpg";

/** Standalone image view — truckbox.app/dat opens dat-example.jpg full-screen. */
export default function DatExample() {
  useEffect(() => {
    document.title = "Truck Box — DAT example";
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #060911)",
        padding: "max(16px, env(safe-area-inset-top)) 16px",
      }}
    >
      <a href={IMG} target="_blank" rel="noreferrer" aria-label="Open full image">
        <img
          src={IMG}
          alt="DAT example"
          style={{
            maxWidth: "100%",
            maxHeight: "100dvh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            borderRadius: 12,
          }}
        />
      </a>
    </div>
  );
}
