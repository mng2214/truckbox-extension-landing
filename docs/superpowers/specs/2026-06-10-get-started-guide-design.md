# Get Started Guide Page — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)

## Goal

Users are confused about where/how to open and use the Truck Box Chrome
extension. Add a standalone "Get Started" page that walks them through the full
end-to-end flow (install → login → use) with screenshots and a features
overview.

## Scope

- New standalone **route** `/guide` — NOT a section of the scrolling homepage.
- Reachable only via the shared `NAV` list (header, mobile sidebar, footer).
- Same routing/page pattern as the existing `/privacy` page.

## Navigation

- Add one entry to `NAV` in `src/App.tsx`:
  `{ href: "/guide", label: "Get Started", route: true }`
- Position: **immediately after Pricing**, i.e. order becomes
  Features, Pricing, **Get Started**, Learning, FAQ, Privacy, Contact.
- Because header, mobile sidebar, and footer all render from `NAV`, the link
  appears in all three automatically.

## Page structure (top → bottom)

1. **Intro** — one short line framing the page ("From install to first email in
   a few minutes").

2. **Step-by-step flow** — numbered steps, each = screenshot placeholder +
   caption. Callouts where noted:
   1. Install from the Chrome Web Store (link to `INSTALL_URL`).
   2. Pin the extension to the toolbar.
   3. Open DAT and go to the **Search Loads** page.
      - **Callout:** Truck Box only works on the DAT Search Loads page.
   4. Click the Truck Box icon to open the popup.
   5. Open the **Login** tab → **Connect Gmail** (Sign in with Google).
      - **Callout (important):** On the Google consent screen, check the
        "Send email on your behalf" permission box, or sending won't work.
   6. **Refresh the DAT page** to enable Truck Box.
   7. Open the **Email Template** tab and set up your template.
   8. Send broker emails in one click.

3. **Features** — 4 cards mirroring the popup tabs:
   - Email Template
   - Map & Filter
   - Factoring (with NEW badge)
   - Stats

4. **Bottom CTA** — Install button (`INSTALL_URL`).

## Images

- Create folder `public/guide/` (Vite serves `public/` at site root, so images
  are referenced as `/guide/<name>`).
- Create `public/guide/IMAGES.txt` listing every required filename for the user
  to upload later.
- Until real files exist, each image renders as a labeled placeholder box. When
  the user drops in files with the listed names, no code change is needed.

### Required image filenames (see IMAGES.txt)

- `01-install.png`
- `02-pin.png`
- `03-dat-search-loads.png`
- `04-open-popup.png`
- `05-login-connect-gmail.png`
- `05b-consent-send-email-checkbox.png`
- `06-refresh-dat.png`
- `07-email-template.png`
- `08-send-email.png`
- `feature-email-template.png`
- `feature-map-filter.png`
- `feature-factoring.png`
- `feature-stats.png`

## Implementation notes

- Add a `Guide` page component in `src/App.tsx` (or `src/pages/`), wired into the
  router the same way `Privacy` is.
- Reuse existing design tokens/classes (`ed-container`, `ed-label`, etc.) and the
  site's visual language for consistency.
- Preview serves the built `dist`, so rebuild (`npm run build`) to verify.

## Out of scope

- No homepage section for this content.
- No CMS / dynamic content — static page.
- Actual screenshot creation (user uploads later).
