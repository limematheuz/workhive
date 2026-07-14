import {
    parseTaskChecklist,
    type TaskChecklistItem,
} from "./task-checklist.ts";
import { parseChecklistItems, parseTaskChecklistItems } from "./format.ts";

type ChecklistSourceTask = Parameters<typeof parseTaskChecklistItems>[0];

/** Prefer editable markdown checklist; fall back to structured API items. */
export function resolveTaskEditChecklist(
    description: string,
    task?: ChecklistSourceTask,
): TaskChecklistItem[] {
    const fromMarkdown = parseChecklistItems(description).map((item) => ({
        text: item.text,
        checked: item.checked,
        assignedUserId: item.assignedUserId,
        assignedUserName: item.assignedUserName,
        index: item.lineIndex,
    }));
    if (fromMarkdown.length > 0) return fromMarkdown;

    const fromLegacy = parseTaskChecklist(description);
    if (fromLegacy.length > 0) return fromLegacy;

    return parseTaskChecklistItems(task).map((item) => ({
        text: item.text,
        checked: item.checked,
        assignedUserId: item.assignedUserId,
        assignedUserName: item.assignedUserName,
        index: item.lineIndex,
    }));
}
