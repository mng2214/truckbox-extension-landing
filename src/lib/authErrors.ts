import { ApiError } from "./api";

export const INSTALL_EXTENSION_FIRST = 1068;

export const isNoAccount = (e: unknown) => e instanceof ApiError && e.code === INSTALL_EXTENSION_FIRST;
