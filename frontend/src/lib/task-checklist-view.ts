export interface ChecklistViewItem {
    id: string;
    answer: "yes" | "no" | null;
}

export function getChecklistProgress(items: readonly ChecklistViewItem[]) {
    const completed = items.filter(item => item.answer !== null).length;
    const total = items.length;

    return {
        completed,
        pending: total - completed,
        total,
        percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
}

export function filterVisibleChecklistItems<T extends ChecklistViewItem>(
    items: readonly T[],
    hideCompleted: boolean,
): readonly T[] {
    return hideCompleted ? items.filter(item => item.answer === null) : items;
}

export function getFirstPendingChecklistItem<T extends ChecklistViewItem>(
    items: readonly T[],
): T | null {
    return items.find(item => item.answer === null) ?? null;
}
