import { parseTaskChecklist } from "./task-checklist.ts";

export type ChecklistCompletionSource = {
    description?: string | null;
    checklist_items?: Array<{ id: number; completed: boolean }> | null;
    checklist_evidence?: Record<
        string,
        { answer?: "yes" | "no" | null }
    > | null;
};

function hasRecordedStructuredAnswer(
    task: ChecklistCompletionSource,
    itemId: number,
): boolean {
    const answer = task.checklist_evidence?.[`item_${itemId}`]?.answer;
    return answer === "yes" || answer === "no";
}

function isStructuredChecklistItemComplete(
    task: ChecklistCompletionSource,
    item: { id: number; completed: boolean },
): boolean {
    // Old checklist rows were introduced after answers had already been
    // stored in checklist_evidence. Both represent a completed requirement;
    // using either avoids contradictory 2/7 and 7/7 views while the database
    // migration repairs those legacy rows.
    return item.completed || hasRecordedStructuredAnswer(task, item.id);
}

export type TaskChecklistProgress = {
    completed: number;
    total: number;
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
        return task.checklist_items.every((item) => (
                isStructuredChecklistItemComplete(task, item)
        ));
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

/**
 * Uses the same evidence rules as completion so every task surface reports one
 * consistent checklist percentage. A "no" answer closes a requirement too.
 */
export function getTaskChecklistProgress(
    task: ChecklistCompletionSource,
): TaskChecklistProgress {
    if (task.checklist_items && task.checklist_items.length > 0) {
        return {
            total: task.checklist_items.length,
            completed: task.checklist_items.filter((item) => (
                isStructuredChecklistItemComplete(task, item)
            )).length,
        };
    }

    const items = parseTaskChecklist(task.description ?? "");
    const evidence = task.checklist_evidence ?? {};
    return {
        total: items.length,
        completed: items.filter((item, offset) => {
            if (item.checked || item.assignedStatus === "completed") return true;
            const answer = evidence[`parsed_${offset + 1}`]?.answer;
            return answer === "yes" || answer === "no";
        }).length,
    };
}

export function canMarkTaskCompleted(task: ChecklistCompletionSource): boolean {
    return !taskHasChecklist(task) || isTaskChecklistComplete(task);
}

/** Check the incoming description snapshot, as the backend does for a combined edit/status update. */
export function canMarkEditedTaskCompleted(
    storedTask: ChecklistCompletionSource,
    editedDescription: string,
): boolean {
    const incoming = {
        description: editedDescription,
        checklist_evidence: storedTask.checklist_evidence,
    };
    if (!taskHasChecklist({ ...incoming, checklist_items: storedTask.checklist_items })) {
        return true;
    }
    return taskHasChecklist(incoming) && isTaskChecklistComplete(incoming);
}
