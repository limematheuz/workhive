export const TASK_VIEW_FILTER_KEYS = ["status", "location", "worker", "query", "date", "priority", "tab", "attention"] as const;
export function taskViewFilter(key: string, value: string): string {
    if (key === "location" || key === "worker") return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? value : "";
    if (key === "status") return ["pending", "accepted", "progress", "review", "completed"].includes(value) ? value : "";
    if (key === "date") return ["ALL", "UPCOMING", "PAST"].includes(value) ? value : "ALL";
    if (key === "priority") return ["high", "medium", "low"].includes(value) ? value : "";
    if (key === "tab") return ["list", "kanban", "templates"].includes(value) ? value : "list";
    if (key === "attention") return ["late", "unassigned", "completed-week"].includes(value) ? value : "";
    return key === "query" ? value.slice(0, 200) : "";
}
