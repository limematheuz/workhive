import { ApiResponseError } from "./api.ts";

export type LoginAccessBlock = "trial_expired" | "unavailable";

export function getLoginAccessBlock(error: unknown): LoginAccessBlock | null {
    if (!(error instanceof ApiResponseError) || error.status !== 402) return null;
    return error.code === "subscription.trial_expired" ? "trial_expired" : "unavailable";
}
