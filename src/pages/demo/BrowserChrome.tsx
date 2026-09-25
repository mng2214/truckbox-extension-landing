/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import "./browserChrome.css";

type Props = {
  compact?: boolean;
  url: string;
  tabTitle: string;

  status?: { text: string; on: boolean };

  onExtensionClick?: () => void;
  extensionOpen?: boolean;
  bookmarks?: string[];
};

const NAV = [
  { d: "M15 5l-7 7 7 7", dim: false },
  { d: "M9 5l7 7-7 7", dim: true },
  { d: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6", dim: false },
];

const PUZZLE =
  "M14 4a2 2 0 1 1 4 0v1h1.5A1.5 1.5 0 0 1 21 6.5V10h-1a2 2 0 1 0 0 4h1v3.5a1.5 1.5 0 0 1-1.5 " +
  "1.5H16v-1a2 2 0 1 0-4 0v1H8.5A1.5 1.5 0 0 1 7 17.5V14H6a2 2 0 1 1 0-4h1V6.5A1.5 1.5 0 0 1 " +
  "8.5 5H10V4Z";

export default function BrowserChrome({
  compact = false,
  url,
  tabTitle,
  status,
  onExtensionClick,
  extensionOpen = false,
  bookmarks,
}: Props) {
  const iconSize = compact ? 13 : 16;

  return (
    <div className={"tbw" + (compact ? " is-compact" : "")}>
      <div className="tbw-tabstrip">
        <span className="tbw-dots">
          <i />
          <i />
          <i />
        </span>

        <span className="tbw-tab">
          <img src="/logo-96.webp" alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} />
          {tabTitle}
          {!compact && (
            <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          )}
        </span>

        {!compact && (
          <>
            <span className="tbw-tab is-idle" aria-hidden="true">
              Rates — market
            </span>
            <span className="tbw-tab-new" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
          </>
        )}

        {status && (
          <span className={"tbw-status" + (status.on ? " is-on" : "")}>{status.text}</span>
        )}
      </div>

      <div className="tbw-toolbar">
        <span className="tbw-nav" aria-hidden="true">
          {NAV.map((icon) => (
            <i key={icon.d} className={"tbw-navbtn" + (icon.dim ? " is-off" : "")}>
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
                <path d={icon.d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </i>
          ))}
        </span>

        <span className="tbw-url">
          <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="5" y="10" width="14" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {url}
          {!compact && (
            <svg className="tbw-url-star" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8L12 4Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        {onExtensionClick ? (
          <button
            type="button"
            className={"tbw-btn tbw-ext" + (extensionOpen ? " is-on" : "")}
            onClick={onExtensionClick}
            title="TruckBox"
          >
            <img src="/logo-96.webp" alt="" width={19} height={19} />
          </button>
        ) : (
          <span className="tbw-btn" aria-hidden="true">
            <img src="/logo-96.webp" alt="" width={16} height={16} />
          </span>
        )}

        <span className="tbw-btn is-inert" aria-hidden="true">
          <svg width={compact ? 14 : 17} height={compact ? 14 : 17} viewBox="0 0 24 24" fill="none">
            <path d={PUZZLE} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>

        <span className="tbw-avatar" aria-hidden="true">
          D
        </span>

        {!compact && (
          <span className="tbw-btn is-inert" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.7" fill="currentColor" />
              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
              <circle cx="12" cy="19" r="1.7" fill="currentColor" />
            </svg>
          </span>
        )}
      </div>

      {bookmarks && (
        <div className="tbw-bookmarks" aria-hidden="true">
          {bookmarks.map((name) => (
            <span key={name} className="tbw-bookmark">
              <i />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
