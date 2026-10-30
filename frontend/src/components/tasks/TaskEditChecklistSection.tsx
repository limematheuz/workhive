"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem, User } from "@/types/user";
import type { TaskChecklistEdit } from "@/types/task-update";
import { assignTaskChecklistItem, toggleTaskChecklistItem } from "@/lib/task-checklist";
import { resolveTaskEditChecklist } from "@/lib/resolve-task-edit-checklist";
import { localizeTaskDescription } from "@/lib/task-display";
import { changeStructuredChecklistDraft, projectTaskChecklistEdits, structuredChecklistRows } from "@/domain/tasks/task-checklist-edit";
import { Textarea } from "@/components/ui/textarea";
import { TaskChecklistEditor } from "./TaskChecklistEditor";
import { taskFormSectionClass, taskFormSectionHeaderClass, taskFormSectionTitleClass, taskFormSectionHintClass, taskFormTextAreaClass } from "./taskFormLayout";

interface Props {
    dict: Dictionary;
    task: TaskItem;
    description: string;
    onDescriptionChange: (value: string) => void;
    edits: TaskChecklistEdit[];
    onEditsChange: (value: TaskChecklistEdit[]) => void;
    users: User[];
    canEdit: boolean;
}

export function TaskEditChecklistSection({ dict, task, description, onDescriptionChange, edits, onEditsChange, users, canEdit }: Props) {
    const view = projectTaskChecklistEdits(task, edits, users);
    const textItems = resolveTaskEditChecklist(localizeTaskDescription(description) || "");
    const storedItems = structuredChecklistRows(view).map(item => ({
        index: -item.id, text: item.text, checked: item.completed,
        assignedUserId: item.assignments[0]?.user_id,
        assignedUserName: item.assignments[0]?.user_name,
        assignedUserIds: item.assignments.map(assignment => assignment.user_id),
    }));
    const items = [...textItems, ...storedItems];
    const assign = (index: number, userId: string) => {
        if (index < 0) {
            onEditsChange(changeStructuredChecklistDraft(task, edits, { id: -index, assigned_user_ids: userId === "unassigned" ? [] : [Number(userId)] }));
        } else {
            const user = users.find(user => String(user.id) === userId);
            onDescriptionChange(assignTaskChecklistItem(description, index, userId, user?.full_name || user?.email || ""));
        }
    };
    return <section className={taskFormSectionClass}>
        <div className={taskFormSectionHeaderClass}>
            <h3 className={taskFormSectionTitleClass}>{dict.tasks?.create_dialog?.checklist || "Checklist and instructions"}</h3>
            <p className={taskFormSectionHintClass}>{dict.tasks?.create_dialog?.services_section_hint || "Select fixed work, review steps and assign owners."}</p>
        </div>
        {items.length ? <TaskChecklistEditor items={items} users={users} canEdit={canEdit}
            onToggle={index => index < 0
                ? onEditsChange(changeStructuredChecklistDraft(task, edits, { id: -index, completed: !storedItems.find(item => item.index === index)?.checked }))
                : onDescriptionChange(toggleTaskChecklistItem(description, index))}
            onAssign={assign}
            onAssignAll={userId => {
                let next = edits;
                for (const item of storedItems) next = changeStructuredChecklistDraft(task, next, { id: -item.index, assigned_user_ids: userId === "unassigned" ? [] : [Number(userId)] });
                onEditsChange(next);
                const user = users.find(user => String(user.id) === userId);
                onDescriptionChange(textItems.reduce((text, item) => assignTaskChecklistItem(text, item.index, userId, user?.full_name || user?.email || ""), description));
            }}
        /> : <Textarea id="task-edit-checklist" value={description} onChange={event => onDescriptionChange(event.target.value)} disabled={!canEdit} rows={4} aria-label={dict.tasks?.create_dialog?.checklist || "Checklist and instructions"} className={taskFormTextAreaClass} />}
    </section>;
}
