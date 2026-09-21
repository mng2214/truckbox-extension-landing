# Interactive demo — design

**Goal:** a page on the landing where a dispatcher uses TruckBox without installing anything and
without a load-board account: a simulated board with the extension already "installed", every
feature working on mock data, walked through by a guided tour that starts at the sign-in popup.

**Why:** TruckBox cannot be tried today. It needs the extension plus a paid DAT or Truckstop
account, so the landing can only show pictures of the product. The demo removes both barriers.

**Where:** the landing repository, route `/demo`, lazily loaded. Nothing real behind it — no
backend, no network, all data is mock.

---

## 1. What the user sees

The page opens on a browser frame: a toolbar with the TruckBox icon, and behind it the board,
dimmed. The extension popup hangs from the toolbar icon in its signed-out state. The first thing
the user does is sign in; the dim lifts and the board comes alive.

From there the tour walks the full path — popup, templates, board rows, an opened load, the
profit calculator, saved loads, the broker email — and then leaves the board fully usable.

### Sign-in

The popup's own sign-in screen is the real one. Clicking "Sign in with Google" does **not** render
a replica of Google's account chooser: it shows a clearly labelled placeholder card ("Google's
account chooser opens here — in the demo we skip it") and the popup switches to its signed-in
state under a demo account.

No screen in the demo ever contains a password, credential or payment field. A page that imitates
a provider's sign-in form is a phishing pattern regardless of intent, and it buys nothing here.

---

## 2. Architecture

Four layers, three of them thin:

| Layer | What it is |
| --- | --- |
| Board | Static markup that reproduces the DOM contract below, styled with our own CSS, filled from mock data |
| `chrome.*` shim | Replaces the extension APIs: storage on `localStorage`, messaging on a mock router |
| Mock backend | Answers every message type with plausible data; unknown types answer benignly |
| Popup | The real popup, in an iframe |

**The extension's own code runs unmodified.** All eight content modules (`load-parser`,
`ui-injector`, `profit-calc`, `saved-loads`, `template-menu`, `maps-integration`,
`keyboard-shortcuts`, `load-capture`) and the popup are loaded as-is. That is the whole point: one
source of truth, so a change to a feature shows up in the demo without a second implementation to
keep in sync.

Two facts make this work, both verified in the extension source:

- **Content scripts make no network calls of their own.** Everything goes through
  `chrome.runtime.sendMessage`, so shimming the runtime fully isolates the demo — there is no path
  from the demo page to `platform.truckbox.app`.
- **The popup already runs in an iframe.** `src/popup/modules/embed-autosize.js` exists for the
  in-page "Open TruckBox" modal: it measures its content and reports the height to the parent via
  `postMessage`. The demo reuses that mechanism.

One exception to patch: `src/popup/modules/auth-subscription.js` calls `fetch(API_BASE_URL + path)`
directly. The demo installs a `fetch` stub inside the iframe before the popup modules load.

### Vendoring the extension code

Vercel builds the landing repository alone, so `../datemailer` does not exist in CI. The extension
files are therefore **committed into the landing** under `public/demo/ext/`, refreshed by
`npm run sync:ext` (a script that copies `src/content/modules/*`, `src/popup/**` and the icons from
the sibling checkout). The script also prints a diff summary, so a stale copy is visible before a
release rather than after.

`chrome.runtime.getURL(path)` in the shim maps to `/demo/ext/<path>`, which keeps
`maps-integration.js:863` working — it opens the popup by exactly that call.

---

## 3. The DOM contract

The content scripts query DAT's markup directly. The board must therefore carry these names; the
visual styling is ours, only the structure is fixed.

**Custom elements:** `dat-load-details`, `dat-rate`, `dat-route`, `dat-company`,
`dat-company-ratings`, `dat-equipment`, `load-search-load-details-general-details-tab`,
`shared-map`, `shared-credit-stop-details`.

**Classes:** `.details-column`, `.details-header`, `.details-container`, `.data-item`,
`.data-item-total`, `.data-label`, `.data-row`, `.row-cells`, `.ag-cell`, `.table-row-detail`,
`.table-cell.cell-timing`, `.timing-container`, `.route-origin .city`, `.route-origin .date`,
`.route-destination .city`, `.trip-miles`, `.details-subheader-mileage .trip-miles`,
`.load-details-general-tab-rates-wrapper`, `.city-spacing`, `.trip-place > div`.

**Attributes:** `[data-test="load-contact-cell"]`, `[data-test="load-pick-up-cell"]`,
`[data-test="load-trip-cell"]`, `[data-test="route-details"]`, `[data-test="origin-input"]`,
`[data-test="search-tab-group"] [role="tab"]`, `[data-testid="posted-rate"]`,
`[data-testid="origin-deadhead"]`, `[data-testid="distance"]`, `[data-testid="contact-broker-mc"]`,
`[data-testid="authority-requirement"]`.

A row expands into a details panel exactly as the board does, because `ui-injector` mounts into
`.details-column` and `profit-calc` into the column that holds `dat-rate`.

**Branding:** the board is visually close to DAT — same columns, same expand behaviour, same
density — but carries no DAT logo, wordmark or product name, and a line under it reads: *"A
simulated load board with demo data. TruckBox is an independent product and is not affiliated with
any load board."*

---

## 3a. The board is a working board, not a picture

Everything is clickable, because the tour ends and the user keeps poking. The board itself — not
only our injected parts — has to behave:

- **Rows expand and collapse** into the details panel, one at a time, exactly as the real one does.
  This is the hinge the whole demo hangs on: `ui-injector` and `profit-calc` mount when a row
  opens.
- **Sorting** by Age, Rate and Trip, with the arrow flipping.
- **Row hover and selection** states, and the checkbox column.
- **"Refresh Loads"** re-shuffles the list and prepends a couple of fresh rows with new ages, so
  the board feels live and the extension re-injects into new rows (that path — row recycling — is
  real extension behaviour worth showing).
- **The search form** above the grid accepts an origin and destination and filters the mock loads.
- **Day / night toggle**, since the board has one and the extension follows it.
- **Keyboard shortcuts** work on the focused row (W/S to move, E to email, C to copy), because
  `keyboard-shortcuts.js` runs unmodified.

Every one of these is driven by the mock data store, so an action changes state that the rest of
the page reads back: star a load and the Saved loads panel count changes; edit a template in the
popup and the email preview uses it; change the diesel price and every open calculator follows.

---

## 4. The shim contract

`chrome.storage.local` → `localStorage` under a `tbdemo:` prefix, with `storage.onChanged` fired
synchronously. `chrome.runtime.onMessage` → an in-page event bus. `chrome.runtime.id` → a constant.
`chrome.tabs.*` → no-ops that log.

`chrome.runtime.sendMessage` routes these types (every one the extension sends today):

| Group | Types | Mock answer |
| --- | --- | --- |
| Auth | `auth_me`, `token` | demo user, live plan, seat |
| Templates | `templates_get` | three templates with placeholders |
| Mailboxes | `mailboxes_list` | two connected mailboxes |
| Saved loads | `saved_loads_get`, `saved_load_save`, `saved_load_remove`, `saved_load_note`, `saved_loads_clear` | in-memory list, persisted to `localStorage` |
| Fuel | `fuel_price_get` | fixed weekly price, `source: "eia"` |
| Lane analytics | `lane_price_history`, `lane_intraday_price`, `lane_posting_frequency`, `lane_view_quota`, `lane_view_record` | generated series per lane |
| Factoring | `rts_check`, `triumph_check`, `triumph_status`, `triumph_token`, `apex_check`, `apex_status`, `factoring_detect` | pre-filled credit result; the login openers are inert |
| Telemetry / actions | `analytics_event`, `datx_capture_loads`, `datx_flush_loads`, `datx_map_click`, `datx_phone_call`, `datx_email_click` | swallowed; `datx_email_click` opens the "email preview" instead of sending |
| Openers | `apex_open_login`, `rts_open_login`, `triumph_open_login`, `open_factoring_settings` | show a "not in the demo" note |

Unknown type → log to console, answer `{ok: true}`. The demo must never surface an error toast
because a message was missed.

---

## 5. Mock data

- **15–20 loads**, invented origins, destinations, rates, weights and pickup dates; one "hero" load
  the tour uses, with a deadhead so the calculator's DH switch has something to switch.
- **Brokers**: invented companies, MC numbers, phones and emails. No real company appears anywhere
  — the same rule we apply to the screenshots on the landing.
- **Lane history**: a generated price series per lane so the analytics panel and the saved-load
  price delta have something to show.
- **Templates, mailboxes, saved loads, stats**: small fixed sets, stored in `localStorage` so the
  user's own edits survive a reload and a "Reset demo" button clears them.

---

## 6. The tour

Starts automatically, every step skippable, eight steps, each asking for an action rather than
narrating:

1. The popup is open over the dimmed board — sign in.
2. What is inside the popup, in one sentence.
3. Edit a template placeholder and watch the preview change.
4. Close the popup: the board, with our marks on every row.
5. Open the hero load — route, loaded miles, deadhead.
6. Profit calculator — change the rate, watch the profit and the break-even move.
7. Star the load, open the Saved loads panel.
8. Email the broker — show the composed email, and say plainly that in the product this sends from
   the user's own Gmail.

After the last step the board stays live and the user explores freely. A "Restart tour" control
stays in the corner.

A persistent badge reads **"Demo — mock data, nothing is sent, no account needed"**. Every
outbound action is intercepted at the shim, not at the UI, so there is no path where a stray click
reaches a real service.

---

## 7. Mobile

Below ~1100px the demo does not render. Instead: a short muted autoplay video of the same scene, a
"Send me the link" field that mails the `/demo` URL, and the usual "Try free" CTA. The copy
explains the constraint ("the demo runs a full load board — it needs a desktop screen") rather than
rejecting the device.

The route is prerendered with real text and the video poster, so `/demo` is not an empty page for
crawlers; the interactive layer loads over it.

---

## 8. Build and performance

- Separate lazy chunk; nothing of the demo is downloaded on the rest of the site.
- Extension modules served as static files from `public/demo/ext/`, not bundled.
- Video in mp4/webm, never gif.
- The demo page is excluded from the landing's image-optimisation pass (its assets are the
  extension's own icons).

---

## 9. Phases

1. **Board + popup + core three**: sign-in, templates, rows, expanded load, profit calculator,
   saved loads, email preview. This is the version worth publishing.
2. **Analytics and map**: lane price history, intraday, posting frequency, the route block.
3. **The rest**: keyboard shortcuts, factoring credit, team/stats tabs in the popup.
4. **Polish**: dark mode (the board has one), "Reset demo", restart tour.

---

## 10. Risks

- **Selector drift.** The board's markup must track DAT's selectors. When DAT changes and the
  extension is updated, the demo skeleton needs the same edit. Mitigation: the contract in §3 lives
  in one file with a comment pointing at this document.
- **Stale vendored copy.** `npm run sync:ext` is manual. A release that forgets it ships an old
  demo. Mitigation: the sync script prints what changed, and the demo shows the copied extension
  version in the corner.
- **Scope.** Feature parity with a product that keeps growing is a standing commitment, not a
  one-off build. Phase 1 is deliberately the part that sells.
