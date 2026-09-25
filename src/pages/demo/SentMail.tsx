/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import "./sentMail.css";

type Props = {
  from: string;
  to: string;
  subject: string;
  body: string;
  broker: string;
  template: string;
  sentAt: string;
};

const FOLDERS = [
  { name: "Inbox", d: "M3 7l9 6 9-6M3 7v10h18V7", count: "12" },
  { name: "Starred", d: "M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8L12 4Z" },
  { name: "Snoozed", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" },
  { name: "Sent", d: "M3 20l18-8L3 4v6l12 2-12 2v6Z", active: true },
  { name: "Drafts", d: "M5 3h9l5 5v13H5V3Zm9 0v5h5" },
];

export default function SentMail({ from, to, subject, body, broker, template, sentAt }: Props) {
  return (
    <div className="mailx">
      <div className="mailx-top">
        <span className="mailx-burger" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </span>
        <span className="mailx-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2.5" y="5" width="19" height="14" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 6l9 7 9-7" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Mail
        </span>
        <span className="mailx-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          in:sent
        </span>
        <span className="mailx-face is-me" aria-hidden="true">
          D
        </span>
      </div>

      <div className="mailx-body">
        <aside className="mailx-side" aria-hidden="true">
          <span className="mailx-compose">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            Compose
          </span>
          <nav className="mailx-folders">
            {FOLDERS.map((f) => (
              <span key={f.name} className={"mailx-folder" + (f.active ? " is-active" : "")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d={f.d} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                {f.name}
                {f.count && <i>{f.count}</i>}
              </span>
            ))}
          </nav>
          <span className="mailx-labels-head">Labels</span>
          <span className="mailx-label">
            <i className="is-brokers" />
            Brokers
          </span>
          <span className="mailx-label">
            <i className="is-lanes" />
            Lanes
          </span>
        </aside>

        <main className="mailx-msg">
          <div className="mailx-tools" aria-hidden="true">
            {[
              "M15 5l-7 7 7 7",
              "M5 8h14v12H5zM9 5h6",
              "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 5v5m0 3h.01",
              "M6 7h12l-1 13H7L6 7Zm3 0V4h6v3",
              "M3 7l9 6 9-6M3 7v10h18V7",
            ].map((d) => (
              <span key={d}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </span>
            ))}
            <span className="mailx-tools-tag">{template}</span>
          </div>

          <h3 className="mailx-subject">{subject}</h3>

          <div className="mailx-head">
            <span className="mailx-face" aria-hidden="true">
              D
            </span>
            <span className="mailx-who">
              <b>Demo Dispatcher</b>
              <span className="mailx-addr">&lt;{from}&gt;</span>
              <span className="mailx-to">
                to {broker} · {to}
              </span>
            </span>
            <span className="mailx-time">{sentAt}</span>
          </div>

          <pre className="mailx-text">{body}</pre>

          <div className="mailx-actions" aria-hidden="true">
            <span className="mailx-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M10 9V5l-7 7 7 7v-4h4a6 6 0 0 1 6 6V9h-10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
              Reply
            </span>
            <span className="mailx-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M14 9V5l7 7-7 7v-4h-4a6 6 0 0 0-6 6V9h10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
              Forward
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
