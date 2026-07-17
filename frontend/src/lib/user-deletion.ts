import { ApiResponseError } from "./api.ts";
import { getErrorMessage } from "./errors.ts";

type UserDeletionCopy = {
    blocked: string;
    fallback: string;
};

export function getUserDeletionErrorMessage(
    error: unknown,
    copy: UserDeletionCopy,
): string {
    if (
        error instanceof ApiResponseError
        && error.code === "USER_HAS_RELATED_DATA"
    ) {
        return copy.blocked;
    }
    return getErrorMessage(error, copy.fallback);
}
