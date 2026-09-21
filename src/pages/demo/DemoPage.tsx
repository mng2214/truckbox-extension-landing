import { useEffect, useRef, useState } from "react";
import BrowserChrome from "./BrowserChrome";
import { mountBoard, type BoardHandle } from "./board/board";
import { demoRuntime, type DemoEvent } from "./runtime/chromeShim";
import { bootExtension, popupSrcDoc } from "./runtime/loadExtension";
import "./board/board.css";
import "./demo.css";

const DESKTOP_WIDTH = 1100;

const isHandheld = () =>
  window.matchMedia("(pointer: coarse)").matches && window.innerWidth < DESKTOP_WIDTH;

export default function DemoPage() {
  const embedded = typeof window !== "undefined" && new URLSearchParams(location.search).get("embed") === "hero";
  const boardHost = useRef<HTMLDivElement>(null);
  const board = useRef<BoardHandle | null>(null);
  const [narrow, setNarrow] = useState(
    () => !embedded && window.innerWidth < DESKTOP_WIDTH,
  );
  const [narrowNotice, setNarrowNotice] = useState(false);
  const [handheld, setHandheld] = useState(() => !embedded && isHandheld());
  const [popupOpen, setPopupOpen] = useState(!embedded);
  const [popupDoc, setPopupDoc] = useState<string | null>(null);
  const [popupHeight, setPopupHeight] = useState(520);
  const [signedIn, setSignedIn] = useState(demoRuntime.signedIn);

  const [popupNonce, setPopupNonce] = useState(0);

  const [disclaimer, setDisclaimer] = useState(true);

  const [booting, setBooting] = useState(!embedded);
  const [bootStage, setBootStage] = useState(0);
  const [chooser, setChooser] = useState<string | null>(null);
  const [email, setEmail] = useState<Extract<DemoEvent, { kind: "email" }> | null>(null);

  useEffect(() => {
    const onResize = () => {
      setNarrow(!embedded && window.innerWidth < DESKTOP_WIDTH);
      setHandheld(!embedded && isHandheld());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [embedded]);

  useEffect(() => {
    if (!booting) return;
    const stages = [1200, 2500, 4000].map((at, i) =>
      window.setTimeout(() => (i === 2 ? setBooting(false) : setBootStage(i + 1)), at),
    );
    return () => stages.forEach(clearTimeout);
  }, [booting]);

  useEffect(() => {
    if (!embedded) return;
    document.documentElement.classList.add("tb-demo-embed");
    return () => document.documentElement.classList.remove("tb-demo-embed");
  }, [embedded]);

  useEffect(() => {
    if (!boardHost.current || board.current) return;

    if (embedded && !demoRuntime.signedIn) demoRuntime.signIn();
    board.current = mountBoard(
      boardHost.current,

      embedded ? { rows: 7, interactive: false, autoplaySeconds: 4 } : {},
    );
    bootExtension().catch((err) => console.error("[demo] extension failed to load", err));
    if (!embedded && !handheld) popupSrcDoc().then(setPopupDoc).catch(() => setPopupDoc(null));
  }, [embedded, handheld]);

  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(".demo-viewport");
    if (!viewport) return;
    const adopt = () => {
      document.body.querySelectorAll<HTMLElement>(":scope > .datx-saved-fab, :scope > .datx-saved-panel")
        .forEach((node) => viewport.appendChild(node));
    };
    adopt();
    const observer = new MutationObserver(adopt);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [embedded]);

  useEffect(() => {
    const run = () => {
      document
        .querySelectorAll<HTMLButtonElement>('.tb-rts-holder button:not([data-demo-checked])')
        .forEach((button) => {
          if (!/credit check/i.test(button.textContent || "")) return;
          button.dataset.demoChecked = "1";
          button.click();
        });
    };
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    run();
    return () => observer.disconnect();
  }, []);

  useEffect(
    () =>
      demoRuntime.on((event) => {
        if (event.kind === "email") setEmail(event);

        if (event.kind === "signin") {
          setSignedIn(true);
          setPopupNonce((n) => n + 1);
        }
        if (event.kind === "signout") {
          setSignedIn(false);
          setPopupNonce((n) => n + 1);
        }
        if (event.kind === "blocked" && event.what === "sign-in") setChooser("google");
        if (event.kind === "blocked" && event.what === "factoring sign-in") setChooser("factoring");
      }),
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; height?: number };
      if (data?.source === "truckbox-popup" && data.type === "height" && data.height) {
        setPopupHeight(Math.min(Math.round(window.innerHeight * 0.78), Math.max(320, data.height + 8)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (handheld) {
    return (
      <div className="demo-page demo-desktop-only">
        <div className="demo-desktop-only-card">
          <span className="demo-gate-eyebrow">Live demo</span>
          <b className="demo-desktop-only-title">Better on a computer</b>
          <p className="demo-desktop-only-text">
            Chrome extensions don&rsquo;t run on phones. Open it on the computer you dispatch from.
          </p>
          <span className="demo-desktop-only-url">truckbox.app/demo</span>
          <a className="ed-btn tb-back-btn demo-gate-cta" href="/">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to TruckBox
          </a>
        </div>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="demo-embed">
        <div className="demo-embed-scale">
          <div ref={boardHost} />
        </div>
        {email && (
          <Modal onClose={() => setEmail(null)} title="This is where the email goes out">
            <div className="demo-email">
              <div>
                <span>To</span>
                {email.to}
              </div>
              <div>
                <span>Subject</span>
                {email.subject}
              </div>
              <pre>{email.body}</pre>
            </div>
            <p className="demo-note">Nothing was sent — this is a demo board.</p>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="demo-page">

      <div className="demo-bar">
        <a className="ed-btn tb-back-btn demo-corner demo-corner-left" href="/">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to TruckBox
        </a>
        <button
          type="button"
          className="ed-btn tb-back-btn demo-corner demo-corner-right"
          onClick={() => {
            demoRuntime.reset();
            location.reload();
          }}
        >
          Reset demo
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="demo-window">
        <BrowserChrome
          url="app.loadboard.demo/search-loads"
          tabTitle="Load board — search"
          onExtensionClick={() => setPopupOpen((v) => !v)}
          extensionOpen={popupOpen}
          bookmarks={["Load board", "Rates", "Fuel prices", "Mail", "Dispatch sheet"]}
        />

        <div
          className="demo-viewport"
          onPointerDownCapture={() => {
            if (narrow) setNarrowNotice(true);
          }}
        >
          <div className={"demo-board-host" + (signedIn ? "" : " is-dimmed")} ref={boardHost} />
          {popupOpen && (
            <div className="demo-popup" style={{ height: popupHeight }}>
              {popupDoc ? (
                <iframe key={popupNonce} title="TruckBox popup" srcDoc={popupDoc} />
              ) : (
                <div className="demo-popup-loading">Loading the extension…</div>
              )}
            </div>
          )}
        </div>

      </div>

      {narrowNotice && (
        <Modal onClose={() => setNarrowNotice(false)} title="Better on a computer">
          <p>
            This is a real fourteen-column load board with the extension running on top of it. It
            works here, but the columns and the panels were drawn for a desktop screen — open
            truckbox.app/demo on the computer you dispatch from for the full thing.
          </p>
        </Modal>
      )}

      {booting && (
        <div className="demo-modal-backdrop demo-boot">
          <div className="demo-boot-inner">
            <span className="tb-oracle-loader" />
            <b className="demo-boot-title">Preparing environment</b>
            <span className="demo-boot-label">
              {["Starting the browser", "Installing TruckBox", "Loading the board"][bootStage]}…
            </span>
            <span className="demo-boot-sub">Simulated — nothing is installed on your machine</span>
          </div>
        </div>
      )}

      {!booting && disclaimer && (
        <div className="demo-modal-backdrop demo-gate">
          <div className="demo-modal demo-gate-card" role="dialog" aria-modal="true">
            <span className="demo-gate-eyebrow">Read this first</span>
            <b className="demo-gate-title">Everything on this board is made up</b>

            <ul className="demo-gate-list">
              <li>
                <strong>Every load, broker, company name, MC number, phone and email is
                invented.</strong>{" "}
                Any resemblance to a real company or person is coincidence, and the prices are
                illustrative — not market rates.
              </li>
              <li>
                <strong>Nothing is sent and nothing leaves your browser.</strong> No email reaches a
                broker, no account is touched, and the demo keeps its state on this device only.
              </li>
              <li>
                <strong>TruckBox is an independent product.</strong> It is not affiliated with,
                endorsed by or connected to any load board or factoring company. The board below
                simulates one — it is not any particular service.
              </li>
            </ul>

            <button
              type="button"
              className="ed-btn tb-back-btn demo-gate-cta"
              onClick={() => setDisclaimer(false)}
            >
              Got it — open the demo
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h13M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {chooser === "google" && (
        <Modal onClose={() => setChooser(null)} title="Sign-in happens in your browser">
          <p>
            In the product this opens your own Google or Microsoft account chooser. The demo does
            not imitate that screen — press continue and you are in, as a demo account.
          </p>
          <button
            type="button"
            className="demo-primary"
            onClick={() => {
              demoRuntime.signIn();
              setChooser(null);
            }}
          >
            Continue as demo@truckbox.app
          </button>
        </Modal>
      )}

      {chooser === "factoring" && (
        <Modal onClose={() => setChooser(null)} title="Not in the demo">
          <p>
            Broker credit uses your own factoring account — RTS, Triumph or Apex. The demo shows a
            fixed result instead of asking you to sign in to anything.
          </p>
        </Modal>
      )}

      {email && (
        <Modal onClose={() => setEmail(null)} title="This is where the email goes out">
          <div className="demo-email">
            <div>
              <span>From</span>
              {email.from}
            </div>
            <div>
              <span>To</span>
              {email.to}
            </div>
            <div>
              <span>Subject</span>
              {email.subject}
            </div>
            <pre>{email.body}</pre>
          </div>
          <p className="demo-note">
            In the product this sends from your own mailbox and the broker's reply lands in your
            inbox. Nothing was sent here.
          </p>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="demo-modal-backdrop" onClick={onClose}>
      <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="demo-modal-head">
          <b>{title}</b>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
