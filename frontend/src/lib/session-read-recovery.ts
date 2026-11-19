import { getApiErrorStatus } from "./read-recovery.ts";

/** Cached identity permits local work only, never an authenticated API request. */
export function mayRecoverCachedSession(error: unknown, pathname: string, online: boolean): boolean {
    const status = getApiErrorStatus(error);
    if (status !== null && status < 500 && status !== 408 && status !== 429) return false;
    return !online || pathname === "/worker" || pathname.startsWith("/worker/");
}
