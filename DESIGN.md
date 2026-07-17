# Design — TruckBox back office (Swiss)

> Applies to the **back office only** (`/business/*`, everything under `body.tb-cabinet-bg`). The
> public landing keeps its own editorial dark system, untouched. Register: **product**. Approved
> direction: **Swiss** — stark, grid-driven, heavy sans, sharp corners, one electric accent, plus a
> purple treatment reserved for premium features.

## Theme

Light is the default; dark is a toggle. Both get the Swiss palette. Tokens are overridden **scoped to
the cabinet** so the landing (no `.tb-cabinet-bg`) is never affected:

- `[data-theme="light"] body.tb-cabinet-bg { …light Swiss tokens… }` (default)
- `body.tb-cabinet-bg { …dark Swiss tokens… }` (dark = no `data-theme` on `<html>`)

## Color

Light (primary):
- `--bg` page `#f4f4f5` · `--bg-2` surface `#ffffff`
- `--ink` `#0a0a0a` · `--sub` `#3d3d3f` · `--muted` `#8a8a8e`
- `--line` hairline `#dcdce1` (thin, gray — NOT heavy black)
- `--accent` electric blue `#3a5bff` · `--accent-ink` (hover/darker) `#1f43ff` · `--accent-tint` `#e8ebff`
- `--pp` premium purple `#7b5cff` · `--pp-ink` `#5b3fe0` · `--pp-tint` `#f0ecff`
- `--danger` `#d64545`

Dark: surface `#141416` on page `#0d0d0f`, ink `#f2f2f4`, line `rgba(255,255,255,.09)`; accent stays
`#1f43ff` (glows on dark), purple `#8b78ff`.

Accent is functional only (active nav, primary button, toggle-on, meter fill, Owner chip). Purple is
reserved for **premium features** (Oracle, Agent) — never decoration.

## Type

One family: **Instrument Sans** (already loaded), weights 400/500/600/700. No display font
(Bricolage), no mono — both are landing-only. Enforced by remapping the token in the cabinet:
`body.tb-cabinet-bg { --font-mono: var(--font-sans) }`, so even inline `var(--font-mono)` usages
(segmented toggles, `+EQUIPMENT`, RADIUS, "100 mi", codes) render in sans. Landing keeps its mono.

One tight, stepped scale so the whole back office reads as one system — no screen shouts at its own
size. Every `h1.ed-display` is pinned to the same calm value (cabinet-scoped `!important`), which
overrides the old divergent per-panel sizes (`text-[8vw]`, inline `2.5–4rem`, etc):

- Page title (`h1.ed-display`): `clamp(1.6rem, 1.2rem + 1.5vw, 2rem) / 700`, uppercase,
  `letter-spacing: -0.025em`, `text-wrap: balance`.
- Big numbers (metrics): `clamp(1.55rem, 1.15rem + 1.4vw, 1.9rem) / 700`, `-0.035em`,
  `font-variant-numeric: tabular-nums` — always a hair below the title so the title leads.
- Section headings: `h2` 1.35rem · `h3` 1.15rem · `h4` 1rem (normalized, cabinet-scoped).
- Eyebrow / mini-label (`.ed-label` in cabinet): `0.72rem / 700`, uppercase, `letter-spacing: 0.05em`,
  color `--muted`. Legible because short + bold sans (the old mono was the readability problem).
- Body: `0.875rem / 400–500`. Fixed rem scale, no fluid clamp inside panels.

## Shape & lines

- **Sharp corners everywhere** — `--radius: 0`. Buttons, inputs, chips, panels, the seat switch.
  Enforced globally by `body.tb-cabinet-bg *:not(.tb-spinner) { border-radius: 0 !important }` so
  stray inline/rounded radii in not-yet-converted panels still read sharp. Only the loading spinner
  stays circular.
- Structure is drawn with **thin gray hairlines** (`1px solid var(--line)`), often as a module grid
  (metrics divided by vertical rules; section headers on a bottom rule). Never heavy black.

## Components

- **Nav** (`.tb-nav`): uppercase bold; hover = neutral gray fill; active = accent-tint bg + accent
  text. Each item has a lucide icon. **Oracle & Agent are premium**: purple icon + a small purple
  sparkle marker at rest, purple-tint hover.
- **Metrics row**: 3-up module grid in a hairline box, big tabular numbers; a seat meter is a flat
  bar with accent fill.
- **Member rows**: hairline-separated rows (not cards); initials square, name + email, role chip,
  status, and the seat control.
- **Chips**: Owner = accent fill, Manager = ink fill, Dispatcher = hairline outline. All sharp,
  uppercase micro.
- **Seat switch**: sharp (square knob), accent when on. Label **"Extension access"**; dispatchers
  (always licensed) read **"Access included"**, no toggle.
- **Buttons**: sharp; primary = accent fill white text; secondary = surface + hairline. Uppercase
  bold micro.
- **Inputs**: sharp, hairline border, accent focus ring.

## Copy

Seat = access to the **TruckBox extension for DAT and Truckstop**. Toggle label "Extension access";
onboarding checkbox becomes "I'll use the TruckBox extension too". No walls of text — one help line
per panel.

## Responsive

Mobile-first. Sidebar → existing top bar + drawer. Metrics reflow to a 2-column module grid (primary
metric full-width). Member rows collapse: identity left, seat control stacked right. Touch targets
≥ 44px.

## Accessibility

Body ≥ 4.5:1 both themes; `#1f43ff` on white ≈ 5.9:1. Focus-visible rings. `prefers-reduced-motion`:
toggles/hovers snap, no choreography.
