/**
 * Oracle's mark: an eye whose two corners are the ends of a lane, with the load as its pupil —
 * the tool looks at one corridor and shows who keeps running it. Inherits `currentColor`, so it
 * picks up the premium purple in the sidebar and the accent on the panel heading.
 */
export function OracleMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* The lane, out and back: together the two runs draw the eye. */}
      <path d="M2.6 12C6.2 4.6 17.8 4.6 21.4 12" />
      <path d="M2.6 12C6.2 19.4 17.8 19.4 21.4 12" />
      {/* Origin and destination. */}
      <circle cx="2.6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21.4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      {/* The load that keeps repeating on it. */}
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
