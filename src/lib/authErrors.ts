/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { ApiError } from "./api";

export const INSTALL_EXTENSION_FIRST = 1068;

export const isNoAccount = (e: unknown) => e instanceof ApiError && e.code === INSTALL_EXTENSION_FIRST;
