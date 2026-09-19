// Plain-text guards for free-text form fields (the backend validates the same rules).

/** Carrier MC number: digits only, up to 10. */
export const mcDigits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

/** One line of plain text: no angle brackets, no control characters (line breaks included). */
export const plainText = (v: string) =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  v.replace(/[<>\x00-\x1f\x7f]/g, "");
