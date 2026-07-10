import { TaskItem } from "@/services/task.service";

export const getStatusWeight = (t: TaskItem) => {
    if (t.is_invoiced) return 5;
    if (t.status === "completed") return 4;
    if (t.status === "review" || t.status === "in_review") return 3;
    if (t.status === "progress" || t.status === "in_progress") return 2;
    return 1; // pending
};

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
