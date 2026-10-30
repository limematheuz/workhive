export interface TaskChecklistItem {
    text: string;
    checked: boolean;
    assignedUserId?: number;
    assignedUserIds?: number[];
    assignedUserName?: string;
    assignedStatus?: TaskChecklistAssignmentStatus;
    index: number;
}

type TaskChecklistAssignmentStatus =
    | "pending"
    | "accepted"
    | "rejected"
    | "progress"
    | "completed"
    | "review";

const CHECKLIST_ASSIGNMENT_STATUSES = new Set<TaskChecklistAssignmentStatus>([
    "pending",
    "accepted",
    "rejected",
    "progress",
    "completed",
    "review",
]);

function parseChecklistAssignmentMeta(meta?: string): {
    name?: string;
    status?: TaskChecklistAssignmentStatus;
} {
    if (!meta) return {};

    const parts = meta
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);
    const status = parts.at(-1);

    if (status && CHECKLIST_ASSIGNMENT_STATUSES.has(status as TaskChecklistAssignmentStatus)) {
        return {
            name: parts.slice(0, -1).join(":") || undefined,
            status: status as TaskChecklistAssignmentStatus,
        };
    }

    return { name: meta.trim() || undefined };
}

export function parseTaskChecklist(description: string): TaskChecklistItem[] {
    if (!description) return [];

    const items: TaskChecklistItem[] = [];
    description.split("\n").forEach((line, index) => {
        const match = line.match(
            /^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?$/
        );
        if (!match) return;

        const assignment = parseChecklistAssignmentMeta(match[4]);
        items.push({
            text: match[2].trim(),
            checked: match[1].toLowerCase() === "x",
            assignedUserId: match[3] ? Number.parseInt(match[3], 10) : undefined,
            assignedUserName: assignment.name,
            assignedStatus: assignment.status,
            index,
        });
    });
    return items;
}

export function toggleTaskChecklistItem(
    description: string,
    itemIndex: number
): string {
    const lines = description.split("\n");
    const line = lines[itemIndex];
    if (line === undefined) return description;

    const match = line.match(
        /^(\s*[-*]?\s*\[)\s*([xX\s])\s*(\]\s*)(.+)$/
    );
    if (!match) return description;

    const newBox = match[2].toLowerCase() === "x" ? " " : "x";
    lines[itemIndex] = `${match[1]}${newBox}${match[3]}${match[4]}`;
    return lines.join("\n");
}

export function assignTaskChecklistItem(
    description: string,
    itemIndex: number,
    userId: string,
    userName = ""
): string {
    const lines = description.split("\n");
    const line = lines[itemIndex];
    if (line === undefined) return description;

    const match = line.match(
        /^(\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*)(.+?)(?:\s*\(@\d+(?::[^)]+)?\))?$/
    );
    if (!match) return description;

    const suffix = userId === "unassigned" ? "" : ` (@${userId}:${userName})`;
    lines[itemIndex] = `${match[1]}${match[2].trim()}${suffix}`;
    return lines.join("\n");
}

export function isTaskChecklistFullyDistributed(
    items: TaskChecklistItem[]
): boolean {
    return items.length > 0 && items.every((item) => Boolean(item.assignedUserId));
}
