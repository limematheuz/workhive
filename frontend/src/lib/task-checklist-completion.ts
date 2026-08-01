import { parseTaskChecklist } from "./task-checklist.ts";

export type ChecklistCompletionSource = {
    description?: string | null;
    checklist_items?: Array<{ completed: boolean }> | null;
    checklist_evidence?: Record<
        string,
        { answer?: "yes" | "no" | null }
    > | null;
};

export function taskHasChecklist(task: ChecklistCompletionSource): boolean {
    if (task.checklist_items && task.checklist_items.length > 0) {
        return true;
    }
    return parseTaskChecklist(task.description ?? "").length > 0;
}

/** Mirrors backend all_task_checklist_items_are_complete / checklist_snapshot_is_complete. */
export function isTaskChecklistComplete(task: ChecklistCompletionSource): boolean {
    if (task.checklist_items && task.checklist_items.length > 0) {
        return task.checklist_items.every((item) => item.completed);
    }

    const items = parseTaskChecklist(task.description ?? "");
    if (items.length === 0) {
        return true;
    }

    const evidence = task.checklist_evidence ?? {};
    return items.every((item, offset) => {
        if (item.checked || item.assignedStatus === "completed") return true;
        const answer = evidence[`parsed_${offset + 1}`]?.answer;
        return answer === "yes" || answer === "no";
    });
}

export function canMarkTaskCompleted(task: ChecklistCompletionSource): boolean {
    return !taskHasChecklist(task) || isTaskChecklistComplete(task);
}
