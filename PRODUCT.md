# Product

> This repo holds **two surfaces with different registers**. The public landing (`/`, privacy,
> terms) is **brand** — design IS the product, editorial dark aesthetic. The **back office**
> (`/business/*`) is **product** — design SERVES the task. This file's default register is
> **product**, for the back-office restyle; the landing keeps its own brand voice untouched.

## Register

product

## Users

Freight dispatchers, and the owners/managers of small trucking carriers (1–20 people). Two distinct
contexts in the back office:
- **Dispatchers** never see the cabinet — they live in the browser extension (DAT/Truckstop). If
  they land here they're bounced to the extension.
- **Owners & managers** use the cabinet to run the team: add/remove people, grant DAT seats (the
  billable licence), manage the subscription, and read per-dispatcher activity stats. This is a
  management console they check between loads, not a place they live all day.

## Product Purpose

Give the person who pays the bill a fast, trustworthy console to see who's working, control who holds
a paid seat, and manage billing — without reading a wall of text to figure out what a control does.
Success = an owner grasps the state of their team and changes a seat in seconds, on their phone, in a
truck-stop parking lot.

## Brand Personality

Crisp, fast, quietly confident — a professional tool that disappears into the task. Reference feel:
**Linear** (dense, minimal, one accent, keyboard-fast). Not flashy; the landing does the selling,
the cabinet does the work.

## Anti-references

- **Its own landing page.** The cabinet currently borrows the landing's editorial system — mono
  uppercase tracked labels (`.ed-label`), an 800-weight display font (`.ed-display`, Bricolage
  Grotesque) for UI headings. That's brand aesthetics on a work tool: the exact product-register
  failure. Strip it.
- Tiny uppercase tracked eyebrows above every field/section (the `.ed-label` pattern — an absolute
  ban in product UI).
- Display/heading fonts in labels, buttons, or data.
- Walls of explanatory prose under every input. Fewer words; the control should be self-evident.

## Design Principles

1. **The control explains itself.** Prefer a clear label + one line of help over a paragraph. If it
   needs a paragraph, the control is wrong.
2. **Earned familiarity over novelty.** Standard affordances (toggles, rows, tabs) styled cleanly —
   an owner should trust it on sight, like Linear/Stripe.
3. **One type family, fixed scale.** A single well-tuned sans carries headings→labels→data. No
   display font, no mono for labels, no fluid clamp headings inside panels.
4. **Contrast is legibility, not decoration.** Body text hits the ink end of the ramp; muted is for
   genuinely secondary metadata only.
5. **Restyle through tokens, scoped to the cabinet.** All changes live under `body.tb-cabinet-bg`
   and the shared cabinet classes so they propagate to every panel and never touch the landing.

## Accessibility & Inclusion

- Body text ≥ 4.5:1, large/UI text ≥ 3:1, in BOTH light (default) and dark themes.
- Mobile-first: owners use this on a phone. Touch targets ≥ 44px; the seat toggle and nav must work
  one-handed.
- `prefers-reduced-motion`: state changes cross-fade or snap; no choreography.
