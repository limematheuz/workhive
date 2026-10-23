import { ApiResponseError } from "./api.ts";
import { getErrorMessage } from "./errors.ts";

type TaskDeletionCopy = {
    blocked_recorded_work: string;
    not_found: string;
    error: string;
};

export function getTaskDeletionErrorMessage(
    error: unknown,
    copy: TaskDeletionCopy,
): string {
    if (error instanceof ApiResponseError) {
        if (
            error.status === 409
            && error.code === "RESERVATION_TASK_HAS_RECORDED_WORK"
        ) {
            return copy.blocked_recorded_work;
        }
        if (error.status === 404) {
            return copy.not_found;
        }
    }
    return getErrorMessage(error, copy.error);
}
