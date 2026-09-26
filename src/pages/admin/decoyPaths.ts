/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

export const DECOY_ROOTS = [
  "/admin",
  "/administrator",
  "/wp-admin",
  "/wp-login.php",
  "/phpmyadmin",
  "/pma",
  "/cpanel",
  "/admin.php",
  "/backoffice",
  "/console",
  "/.env",
];

export function isDecoyPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return DECOY_ROOTS.some((root) => path === root || path.startsWith(root + "/"));
}
