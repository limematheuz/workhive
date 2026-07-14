type TaskListStatusFields = {
    id: number;
    status: string;
    is_invoiced?: boolean | null;
};

export const getStatusWeight = (t: TaskListStatusFields) => {
    if (t.is_invoiced) return 5;
    if (t.status === "completed") return 4;
    if (t.status === "review" || t.status === "in_review") return 3;
    if (t.status === "progress" || t.status === "in_progress") return 2;
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
