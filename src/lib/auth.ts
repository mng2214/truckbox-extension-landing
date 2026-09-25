/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

const KEY = "tb_jwt";
export const auth = {
  getToken: () => localStorage.getItem(KEY),
  setToken: (t: string) => localStorage.setItem(KEY, t),
  clearToken: () => localStorage.removeItem(KEY),
  isAuthed: () => !!localStorage.getItem(KEY),
};
