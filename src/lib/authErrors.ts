import { ApiError } from "./api";

/** Web sign-in by someone with no TruckBox account: they must install the extension first. */
export const INSTALL_EXTENSION_FIRST = 1068;

export const isNoAccount = (e: unknown) => e instanceof ApiError && e.code === INSTALL_EXTENSION_FIRST;
