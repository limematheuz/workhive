import type { KanbanStatus, TaskStatus } from "@/types/task";

const LEGACY_STATUS_MAP: Record<string, TaskStatus> = {
    in_progress: "progress",
    in_review: "review",
};

export function normalizeTaskStatus(
    status: string | null | undefined,
): TaskStatus {
    if (!status) return "pending";
    if (status in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[status];
    switch (status) {
        case "requested":
        case "pending":
        case "accepted":
        case "rejected":
        case "progress":
        case "review":
        case "completed":
            return status;
        default:
            return "pending";
    }
}
export function isOperationalStatus(status: string | null | undefined): boolean {
    const normalized = normalizeTaskStatus(status);
    return normalized !== "requested" && normalized !== "rejected";
}

export function toKanbanStatus(status: string | null | undefined): KanbanStatus {
    const normalized = normalizeTaskStatus(status);
    if (normalized === "completed") return "completed";
    if (["accepted", "progress", "review"].includes(normalized)) return "progress";
    return "pending";
}

export function completionDateForStatus(status: string): string | null {
    return normalizeTaskStatus(status) === "completed"
        ? new Date().toISOString()
        : null;
}
