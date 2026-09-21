export const mcDigits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

export const plainText = (v: string) =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  v.replace(/[<>\x00-\x1f\x7f]/g, "");
