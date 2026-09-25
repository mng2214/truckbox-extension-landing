/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

export const mcDigits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

export const plainText = (v: string) =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  v.replace(/[<>\x00-\x1f\x7f]/g, "");
