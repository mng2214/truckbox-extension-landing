/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

export const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";

export function installLink(source: string, medium: string): string {
  return `${INSTALL_URL}?utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(medium)}`;
}
