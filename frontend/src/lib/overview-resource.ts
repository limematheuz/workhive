import { ApiResponseError } from "./api.ts";

export function overviewResourceFailureState(error: unknown): "denied" | "error" {
    return error instanceof ApiResponseError && error.status === 403 ? "denied" : "error";
}
