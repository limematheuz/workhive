export const ALL_WORKERS_VALUE = "__ALL__";

export type ChecklistItem = {
    text: string;
    checked: boolean;
    assignedUserId?: number;
    assignedUserName?: string;
    index: number;
};

export const parseChecklist = (desc: string): ChecklistItem[] => {
    if (!desc) return [];
    const lines = desc.split("\n");
    const items: ChecklistItem[] = [];
    lines.forEach((line, index) => {
        const match = line.match(/^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?$/);
        if (match) {
            items.push({
                text: match[2].trim(),
                checked: match[1].toLowerCase() === "x",
                assignedUserId: match[3] ? parseInt(match[3], 10) : undefined,
                assignedUserName: match[4] || undefined,
                index,
            });
        }
    });
    return items;
};
