import type { TaskItem, User } from "../../types/user";
import type { TaskChecklistEdit } from "../../types/task-update";
import { parseTaskChecklist } from "../../lib/task-checklist.ts";

/** Text rows keep their markdown editor; space rows use their stable API id. */
export function structuredChecklistRows(task: TaskItem) {
    const textItems = parseTaskChecklist(task.description ?? "");
    return (task.checklist_items ?? []).filter(item => item.source_line_index === null
        || (item.source_line_index === undefined && !textItems.some(row => row.text === item.text)));
}

export function projectTaskChecklistEdits(task: TaskItem, edits: TaskChecklistEdit[], users: User[] = []): TaskItem {
    const evidence = { ...task.checklist_evidence };
    const items = task.checklist_items?.map(item => {
        const edit = edits.find(edit => edit.id === item.id);
        if (!edit) return item;
        const completed = edit.completed ?? item.completed;
        if (edit.completed !== undefined) evidence[`item_${item.id}`] = { ...evidence[`item_${item.id}`], answer: completed ? "yes" : null };
        const assignments = edit.assigned_user_ids === undefined ? item.assignments : edit.assigned_user_ids.map(id => {
            const existing = item.assignments.find(assignment => assignment.user_id === id);
            const user = users.find(user => user.id === id);
            return existing ?? { user_id: id, user_name: user?.full_name || user?.email || "", status: completed ? "completed" as const : "pending" as const };
        });
        return { ...item, completed, assignments };
    });
    return { ...task, checklist_items: items, checklist_evidence: evidence };
}

export function changeStructuredChecklistDraft(task: TaskItem, edits: TaskChecklistEdit[], change: TaskChecklistEdit): TaskChecklistEdit[] {
    const source = structuredChecklistRows(task).find(item => item.id === change.id);
    if (!source) return edits;
    const next = { ...edits.find(edit => edit.id === change.id), ...change };
    if (next.completed === source.completed) delete next.completed;
    if (next.assigned_user_ids !== undefined) {
        const originalIds = source.assignments.map(assignment => assignment.user_id).sort((a, b) => a - b);
        if (JSON.stringify([...next.assigned_user_ids].sort((a, b) => a - b)) === JSON.stringify(originalIds)) delete next.assigned_user_ids;
    }
    return [...edits.filter(edit => edit.id !== change.id), ...(Object.keys(next).length > 1 ? [next] : [])].sort((a, b) => a.id - b.id);
}

export function readTaskChecklistEdits(form: EventTarget): TaskChecklistEdit[] {
    const value = new FormData(form as HTMLFormElement).get("checklist_updates");
    return typeof value === "string" && value ? JSON.parse(value) as TaskChecklistEdit[] : [];
}
