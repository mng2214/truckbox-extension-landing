import { useEffect, useMemo, useRef, useState } from "react";
import BrowserChrome from "./BrowserChrome";
import { enableDemoTracking, trackDemo } from "../../lib/demoTrack";
import SentMail from "./SentMail";
import Tour, { type TourStep } from "./Tour";
import { mountBoard, type BoardHandle } from "./board/board";
import { demoRuntime, type DemoEvent } from "./runtime/chromeShim";
import { bootExtension, popupSrcDoc } from "./runtime/loadExtension";
import "./board/board.css";
import "./demo.css";

const DESKTOP_WIDTH = 1100;

const TOUR_KEY = "tbdemo:tour";

const isHandheld = () =>
  window.matchMedia("(pointer: coarse)").matches && window.innerWidth < DESKTOP_WIDTH;

const tourTaken = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return false;
  }
};

const demoStage = () => document.querySelector(".demo-window");

const laneOf = (row: Element | null) => {
  if (!row) return undefined;
  const cell = (test: string) =>
    row.querySelector(`[data-test="load-${test}-cell"]`)?.textContent?.trim();
  const from = cell("origin");
  const to = cell("destination");
  return from && to ? `${from} → ${to}` : undefined;
};

const brokerOf = (row: Element | null) =>
  row?.querySelector(".db-cell-company")?.textContent?.trim();

const popupEl = (selector: string) => {
  const frame = document.querySelector<HTMLIFrameElement>(".demo-popup iframe");
  try {
    return frame?.contentDocument?.querySelector(selector) ?? null;
  } catch {
    return null;
  }
};

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

  const [tourOn, setTourOn] = useState(false);
  const [tourRun, setTourRun] = useState(0);
  const signedInRef = useRef(signedIn);
  const popupOpenRef = useRef(popupOpen);
  const emailSeen = useRef(false);

  signedInRef.current = signedIn;
  popupOpenRef.current = popupOpen;

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
    const live = !embedded && !handheld;
    enableDemoTracking(live);
    if (live) trackDemo("open");
    return () => enableDemoTracking(false);
  }, [embedded, handheld]);

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
    if (embedded || handheld) return;

    const board = document.querySelector(".demo-board-host");
    if (!board) return;

    const onClick = (e: Event) => {
      const target = e.target as Element | null;
      const row = target?.closest(".row-container");
      if (!row) return;

      if (target?.closest(".datx-send, .datx-star")) {
        return;
      }
      if (target?.closest(".datx-map-btn, .tb-map-corner")) {
        trackDemo("map", laneOf(row));
        return;
      }
      if (target?.closest(".datx-copy-phone, a[href^='tel:']")) {
        trackDemo("phone", brokerOf(row));
        return;
      }
      trackDemo("load_open", laneOf(row));
    };

    board.addEventListener("click", onClick, true);
    return () => board.removeEventListener("click", onClick, true);
  }, [embedded, handheld, signedIn]);

  useEffect(() => {
    if (embedded || handheld || !popupOpen) return;
    const frame = document.querySelector<HTMLIFrameElement>(".demo-popup iframe");
    if (!frame) return;

    const attach = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const onTab = (e: Event) => {
        const tab = (e.target as Element | null)?.closest<HTMLElement>(".tab");
        if (tab) trackDemo("tab", tab.dataset.tab || tab.textContent?.trim());
      };
      doc.addEventListener("click", onTab, true);
      cleanup = () => doc.removeEventListener("click", onTab, true);
    };

    let cleanup = () => {};
    attach();
    frame.addEventListener("load", attach);
    return () => {
      cleanup();
      frame.removeEventListener("load", attach);
    };
  }, [embedded, handheld, popupOpen, popupDoc, popupNonce]);

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
          const row =
            button.closest(".table-row-detail")?.previousElementSibling ??
            document.querySelector(".datx-row-active");
          trackDemo("credit", brokerOf(row) || laneOf(row));
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
        if (event.kind === "email") {
          emailSeen.current = true;
          setEmail(event);
          trackDemo("email", `${event.broker} · ${event.subject}`);
        }

        if (event.kind === "signin") {
          setSignedIn(true);
          trackDemo("signin");
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

  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        id: "signin",
        title: "Start by signing in",
        text: "TruckBox sends from your own mailbox, so everything begins here. Press Sign in with Google — the demo signs you in as a demo account and never shows a real Google screen.",
        hint: "Open the TruckBox icon in the toolbar to bring the popup back.",
        prepare: () => {
          setPopupOpen(true);
          if (demoRuntime.signedIn) demoRuntime.signOut();
        },
        target: () => popupEl("#login"),
        done: () => signedInRef.current,
        hold: 0,
      },
      {
        id: "template",
        title: "Open the Template tab",
        text: "A template is the email a broker receives. You write it once, and every load fills it in.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="template"]'),
        done: () => !!popupEl("#template-tab.active"),
        success: "Here it is",
      },
      {
        id: "save-template",
        title: "Save the template",
        text: "Change the subject or the body if you like — the {{placeholders}} are replaced with the load\u2019s own origin, destination, rate and your MC. Then press Save Template.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl("#saveBtn"),
        click: true,
        success: "Template saved",
      },
      {
        id: "filters",
        title: "Filters — what the board shows you",
        text: "Turn the route map off to keep the details compact. Grey out duplicates so the same lane, date, rate and broker stop coming back at you. Switch the profit calculator on or off.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="filter"]'),
        done: () => !!popupEl("#filter-tab.active"),
        success: "Filters",
      },
      {
        id: "factoring",
        title: "Connect your factoring company",
        text: "RTS, Triumph or Apex — connect once and the broker's credit check appears inside the load. You log in at the factoring company itself, TruckBox stores no password.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="factoring"]'),
        done: () => !!popupEl("#factoring-tab.active"),
        success: "Factoring",
      },
      {
        id: "subscription",
        title: "Your subscription",
        text: "Status, what the plan covers and the next billing date — all here. Seven days free, no card to start, and cancelling is one button, not an email to support.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="subscription"]'),
        done: () => !!popupEl("#subscription-tab.active"),
        success: "Subscription",
      },
      {
        id: "stats",
        title: "What it actually saved you",
        text: "Emails sent, maps opened and calls placed, split by board — and the hours that adds up to. On a team plan you see every dispatcher.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="stats"]'),
        done: () => !!popupEl("#stats-tab.active"),
        success: "Stats",
      },
      {
        id: "help",
        title: "Help, when you need it",
        text: "The step-by-step guide, how to update the extension, and the quick fixes if something stops responding.",
        prepare: () => setPopupOpen(true),
        target: () => popupEl('.tab[data-tab="help"]'),
        done: () => !!popupEl("#help-tab.active"),
        success: "Help",
      },
      {
        id: "close-popup",
        title: "Back to the board",
        text: "That is the whole setup. Close the popup — everything else happens on the load board itself.",
        target: () => document.querySelector(".tbw-btn.is-on"),
        done: () => !popupOpenRef.current,
        success: "Popup closed",
      },
      {
        id: "send",
        title: "Email a broker in one click",
        text: "TruckBox adds its own buttons to every row. The envelope writes the email from your template and sends it — no copying, no retyping. On the board you never have to reach for it: pick a row with W and S, then press E to send.",
        hint: "Move the mouse over a row to bring the buttons up.",
        target: () => document.querySelector(".row-container .datx-send"),
        done: () => emailSeen.current,
        success: "Email written",
      },
      {
        id: "details",
        title: "Open a load",
        text: "Click the row itself — or press Space, which opens and closes the details of the row you are on. Inside: the broker, the credit check and the route.",
        target: () => document.querySelector(".row-container"),
        done: () => !!document.querySelector("dat-load-details"),
        success: "Load open",
      },
      {
        id: "credit",
        title: "Check the broker before you call",
        text: "TruckBox pulls the broker's credit into the load itself — the grade, days to pay, the credit limit and what is left of it. No second tab, no separate factoring portal.",
        hint: "Open a load to see the credit block.",
        target: () => document.querySelector(".tb-board-rts"),
        manual: true,
      },
      {
        id: "profit",
        title: "The profit calculator",
        text: "Rate, miles with and without deadhead, fuel — the math sits inside the load, so you know your number before you pick up the phone.",
        hint: "Open a load to see the calculator.",
        target: () => document.querySelector(".tb-profit-col"),
        manual: true,
      },
      {
        id: "star",
        title: "Keep the good ones",
        text: "The star saves a load with the price it had at that moment, so you can see later whether it moved.",
        target: () => document.querySelector(".row-container .datx-star:not(.is-on)"),
        done: (el) => !!el?.classList.contains("is-on"),
        success: "Load saved",
      },
      {
        id: "saved",
        title: "Your saved loads",
        text: "Everything you starred lives here — with your notes, the lane price and a calendar of pickup dates.",
        target: () => document.querySelector(".datx-saved-fab"),
        done: () => !!document.querySelector(".datx-saved-panel"),
        success: "There they are",
      },
      {
        id: "saved-panel",
        title: "The list you come back to",
        text: "Each saved load keeps the price it had when you starred it, so you can see whether the lane moved. Add a note, open the calendar by pickup date, and clear the ones that are gone.",
        hint: "Open Saved loads to see the list.",
        target: () => document.querySelector(".datx-saved-panel"),
        manual: true,
      },
    ],
    [],
  );

  const tourStarted = useRef(false);

  useEffect(() => {
    if (embedded || handheld || booting || disclaimer) return;
    if (tourStarted.current || tourTaken()) return;
    tourStarted.current = true;
    setTourOn(true);
  }, [embedded, handheld, booting, disclaimer]);

  const closeTour = () => {
    trackDemo("tour_done");
    setTourOn(false);
    try {
      localStorage.setItem(TOUR_KEY, "done");
    } catch {
      /* storage blocked */
    }
  };

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
        <span className="demo-corner-group">
        <button
          type="button"
          className="ed-btn tb-back-btn demo-corner demo-guide-btn"
          onClick={() => {
            setTourRun((n) => n + 1);
            setTourOn(true);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path
              d="M9.5 9.6a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17" r="1.1" fill="currentColor" />
          </svg>
          Show me around
        </button>
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
        </span>
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
        <Modal wide onClose={() => setEmail(null)} title="Sent — this is what the broker gets">
          <SentMail
            from={email.from}
            to={email.to}
            subject={email.subject}
            body={email.body}
            broker={email.broker}
            template={email.template}
            sentAt={email.sentAt}
          />
        </Modal>
      )}

      {tourOn && (
        <Tour
          key={tourRun}
          steps={tourSteps}
          onStep={(step, index) => trackDemo("tour_step", `${index + 1}. ${step.id}`)}
          stage={demoStage}
          paused={booting || disclaimer || !!email || !!chooser || !!narrowNotice}
          onClose={closeTour}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  wide = false,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="demo-modal-backdrop" onClick={onClose}>
      <div
        className={"demo-modal" + (wide ? " demo-modal-wide" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="demo-modal-head">
          <b>{title}</b>
          <button
            type="button"
            className={wide ? "demo-close is-lit" : "demo-close"}
            onClick={onClose}
            aria-label="Close"
          >
            {wide && <span>Close</span>}×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
