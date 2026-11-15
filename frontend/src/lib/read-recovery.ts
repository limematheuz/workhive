import { ApiResponseError } from "./api.ts";

export type ReadErrorKind = "denied" | "unavailable";

export type ReadRecoveryCopy = {
    unavailable: string;
    denied: string;
    retry: string;
};

export function getApiErrorStatus(error: unknown): number | null {
    if (error instanceof ApiResponseError && typeof error.status === "number") {
        return error.status;
    }
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number" && Number.isFinite(status)) {
            return status;
        }
    }
    return null;
}

export function isReadAccessDeniedError(error: unknown): boolean {
    const status = getApiErrorStatus(error);
    return status === 401 || status === 403 || status === 404;
}

export function classifyReadError(error: unknown): ReadErrorKind {
    return isReadAccessDeniedError(error) ? "denied" : "unavailable";
}

export function shouldShowReadRetry(kind: ReadErrorKind | null): boolean {
    return kind === "unavailable";
}

export function getReadRecoveryMessage(
    kind: ReadErrorKind | null,
    copy: Pick<ReadRecoveryCopy, "unavailable" | "denied">,
): string | null {
    if (kind === "denied") return copy.denied;
    if (kind === "unavailable") return copy.unavailable;
    return null;
}

export function getReadWorkspaceKey(
    user: { company_id?: number | null; id?: number | null } | null | undefined,
): string {
    return `${user?.company_id ?? "none"}:${user?.id ?? "anon"}`;
}
