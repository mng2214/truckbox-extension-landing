# Contact form — design

**Date:** 2026-06-08
**Repo:** datemailerlanding (truckbox.app landing, static Vite/React SPA)

## Goal

Let visitors contact us from the landing page without exposing a real email
address. The visitor fills in email, phone, subject, and message; the submission
is delivered to us via Formspree.

## Approach

The site is statically hosted, so submissions go to **Formspree** (endpoint
`xnjyvqjv`) via the `@formspree/react` `useForm` hook. The existing Contact
section (`src/App.tsx`, `Contact()`) gains a real form on the left; the current
Calendly / Instagram / Facebook rows are kept as quick alternatives on the right
(desktop) / below (mobile). No email address is rendered anywhere.

## Dependency

- Add `@formspree/react`.

## Fields

| Visible field | Form field name | Required | Notes |
|---|---|---|---|
| Email      | `email`    | yes | Formspree sets reply-to to this |
| Phone      | `phone`    | no  | |
| Subject    | `_subject` | yes | becomes the subject line of the email we receive |
| Message    | `message`  | yes | body |
| (honeypot) | `_gotcha`  | —   | hidden; bots fill it, humans don't |

## Spam protection

- Hidden honeypot field `_gotcha` (in code).
- Formspree's built-in invisible reCAPTCHA, enabled in the Formspree dashboard
  (handled automatically by the library — no extra code/keys).
- Cloudflare Turnstile was considered and rejected: Formspree does not verify
  Turnstile tokens server-side, so it would only be a cosmetic client-side gate.

## UX states

- Submit button disabled while `state.submitting`.
- Inline per-field validation via Formspree `ValidationError`.
- On `state.succeeded`, the form is replaced by a "Thanks — we'll reply fast"
  confirmation.
- Network/submit error shows a retryable error line.
- Honors existing reduced-motion handling and design tokens.

## Styling

Matches the existing design system: `ed-label` labels, `ed-btn ed-btn-accent`
submit, `--line` borders, `--accent` focus rings, shared typography. New
`.ed-field` / `.ed-input` / `.ed-textarea` styles added to `src/styles.css`.

## Verification

Run the dev server; confirm the form renders, validates required fields, and
that submit issues a POST to `formspree.io/f/xnjyvqjv`.
