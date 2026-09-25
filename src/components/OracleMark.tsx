/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
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
      <path d="M2.6 12C6.2 4.6 17.8 4.6 21.4 12" />
      <path d="M2.6 12C6.2 19.4 17.8 19.4 21.4 12" />
      <circle cx="2.6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21.4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
