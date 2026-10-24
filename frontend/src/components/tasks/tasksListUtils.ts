import { normalizeTaskStatus } from "../../domain/tasks/task-status.ts";

type TaskListStatusFields = {
    id: number;
    status: string;
    is_invoiced?: boolean | null;
};

export function getTaskListDisplayStatus(status: string): "pending" | "accepted" | "progress" | "review" | "completed" {
    const normalized = normalizeTaskStatus(status);
    if (normalized === "accepted" || normalized === "progress" || normalized === "review" || normalized === "completed") {
        return normalized;
    }
    return "pending";
}

export const getStatusWeight = (t: TaskListStatusFields) => {
    if (t.is_invoiced) return 5;
    const status = getTaskListDisplayStatus(t.status);
    if (status === "completed") return 4;
    if (status === "review") return 3;
    if (status === "progress" || status === "accepted") return 2;
    return 1; // pending
};

export function isTaskFinished(task: Pick<TaskListStatusFields, "status" | "is_invoiced">): boolean {
    return task.status === "completed" || Boolean(task.is_invoiced);
}

export function sortTasksForGeneralList<T extends TaskListStatusFields>(tasks: readonly T[]): T[] {
    return [...tasks].sort((left, right) => {
        const weightDiff = getStatusWeight(left) - getStatusWeight(right);
        if (weightDiff !== 0) return weightDiff;
        return right.id - left.id;
    });
}

export function partitionTasksForGeneralList<T extends TaskListStatusFields>(
    tasks: readonly T[],
): { active: T[]; completed: T[] } {
    const active: T[] = [];
    const completed: T[] = [];
    for (const task of tasks) {
        if (isTaskFinished(task)) completed.push(task);
        else active.push(task);
    }
    return {
        active: sortTasksForGeneralList(active),
        completed: sortTasksForGeneralList(completed),
    };
}

export const TASK_LIST_PAGE_SIZE = 20;

export type TaskListDateScope = "ALL" | "UPCOMING" | "PAST";

export type TaskListSearchable = TaskListStatusFields & {
    title?: string | null;
    description?: string | null;
    due_at?: string | null;
    scheduled_start_at?: string | null;
    created_at: string;
    location_id: number;
    user_id: number | null;
    priority?: string | null;
};

export function filterTasksForGeneralList<T extends TaskListSearchable>(
    tasks: readonly T[],
    options: {
        query: string;
        dateScope: TaskListDateScope;
        priority?: string;
        getLocationName: (locationId: number) => string;
        getAssigneeName: (userId: number | null) => string;
        now?: Date;
    },
): T[] {
    const query = options.query.trim().toLocaleLowerCase("es");
    const today = new Date(options.now ?? Date.now());
    today.setHours(0, 0, 0, 0);
    const priority = options.priority?.trim() || "";

    return tasks.filter((task) => {
        if (priority && task.priority !== priority) return false;

        const planningDate = new Date(task.due_at || task.scheduled_start_at || task.created_at);
        const matchesDate =
            options.dateScope === "ALL"
            || (options.dateScope === "UPCOMING" && planningDate >= today)
            || (options.dateScope === "PAST" && planningDate < today);
        if (!matchesDate) return false;
        if (!query) return true;

        return [
            task.title,
            task.description,
            options.getLocationName(task.location_id),
            options.getAssigneeName(task.user_id),
        ]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase("es").includes(query));
    });
}

export function paginateTaskListPage<T>(
    items: readonly T[],
    page: number,
    pageSize = TASK_LIST_PAGE_SIZE,
): { pageItems: T[]; totalPages: number; safePage: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        pageItems: items.slice(start, start + pageSize),
        totalPages,
        safePage,
    };
}

export type ChecklistItem = {
    text: string;
    checked: boolean;
    assignedUserId?: number;
    assignedUserName?: string;
};

export function parseChecklist(desc: string | null | undefined): ChecklistItem[] {
    if (!desc) return [];
    const lines = desc.split("\n");
    const items: ChecklistItem[] = [];
    lines.forEach((line) => {
        const match = line.match(/^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?$/);
        if (match) {
            items.push({
                text: match[2].trim(),
                checked: match[1].toLowerCase() === "x",
                assignedUserId: match[3] ? parseInt(match[3], 10) : undefined,
                assignedUserName: match[4] || undefined
            });
        }
    });
    return items;
}
