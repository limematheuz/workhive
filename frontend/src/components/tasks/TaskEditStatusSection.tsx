"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";

type TaskEditStatusSectionProps = {
    dict: Dictionary;
    isReceiverCompany: boolean;
    managerEditable: boolean;
    priority: TaskPriority;
    selectedTask: TaskItem;
    status: TaskStatus;
    onPriorityChange: (value: TaskPriority) => void;
    onStatusChange: (value: TaskStatus) => void;
};

export function TaskEditStatusSection({
    dict,
    isReceiverCompany,
    managerEditable,
    priority,
    selectedTask,
    status,
    onPriorityChange,
    onStatusChange,
}: TaskEditStatusSectionProps) {
    return (
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <h3 className={taskFormSectionTitleClass}>
                    {dict.tasks?.create_dialog?.status_section || "Status and progress"}
                </h3>
                <p className={taskFormSectionHintClass}>
                    {dict.tasks?.create_dialog?.status_section_hint
                        || "Only update the status when it matches real work progress."}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-status" className={taskFormLabelClass}>
                        {dict.tasks?.dialog?.status_label || "Status"}
                    </label>
                    <select
                        id="task-edit-status"
                        value={status}
                        onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
                        disabled={!managerEditable}
                        className={taskFormControlClass}
                    >
                        <option value="pending">{dict.tasks?.dialog?.status_pending || "Pending"}</option>
                        <option value="accepted">{dict.tech?.status_accepted || "Accepted"}</option>
                        <option value="rejected">{dict.tech?.status_rejected || "Rejected"}</option>
                        <option value="progress">{dict.tasks?.dialog?.status_progress || "In progress"}</option>
                        <option value="review">{dict.tasks?.dialog?.status_review || "In review"}</option>
                        <option value="completed">{dict.tasks?.dialog?.status_completed || "Completed"}</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-priority" className={taskFormLabelClass}>
                        {dict.tasks?.priority_label || "Priority"}
                    </label>
                    <select
                        id="task-edit-priority"
                        value={priority}
                        onChange={(event) => onPriorityChange(event.target.value as TaskPriority)}
                        disabled={!managerEditable || isReceiverCompany}
                        className={taskFormControlClass}
                    >
                        <option value="low">{dict.tasks?.priority_low || "Low"}</option>
                        <option value="medium">{dict.tasks?.priority_medium || "Medium"}</option>
                        <option value="high">{dict.tasks?.priority_high || "High"}</option>
                    </select>
                </div>
                <div className="flex flex-col justify-end pb-1 text-2xs font-mono font-medium text-[var(--text-muted)]">
                    <div>
                        {dict.tasks?.dialog?.created_at || "Created:"}{" "}
                        {new Date(selectedTask.created_at).toLocaleString("en-US", { timeZone: "UTC" })}
                    </div>
                    {selectedTask.date_done && (
                        <div className="mt-1">
                            {dict.tasks?.dialog?.finished_at || "Finished:"}{" "}
                            {new Date(selectedTask.date_done).toLocaleString("en-US", { timeZone: "UTC" })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
