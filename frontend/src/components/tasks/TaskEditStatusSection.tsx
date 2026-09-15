"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                    <Select
                        value={status}
                        onValueChange={(value) => onStatusChange(value as TaskStatus)}
                        disabled={!managerEditable}
                    >
                        <SelectTrigger id="task-edit-status" className={taskFormControlClass}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">{dict.tasks?.dialog?.status_pending || "Pending"}</SelectItem>
                            <SelectItem value="accepted">{dict.tech?.status_accepted || "Accepted"}</SelectItem>
                            <SelectItem value="rejected">{dict.tech?.status_rejected || "Rejected"}</SelectItem>
                            <SelectItem value="progress">{dict.tasks?.dialog?.status_progress || "In progress"}</SelectItem>
                            <SelectItem value="review">{dict.tasks?.dialog?.status_review || "In review"}</SelectItem>
                            <SelectItem value="completed">{dict.tasks?.dialog?.status_completed || "Completed"}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-priority" className={taskFormLabelClass}>
                        {dict.tasks?.priority_label || "Priority"}
                    </label>
                    <Select
                        value={priority}
                        onValueChange={(value) => onPriorityChange(value as TaskPriority)}
                        disabled={!managerEditable || isReceiverCompany}
                    >
                        <SelectTrigger id="task-edit-priority" className={taskFormControlClass}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">{dict.tasks?.priority_low || "Low"}</SelectItem>
                            <SelectItem value="medium">{dict.tasks?.priority_medium || "Medium"}</SelectItem>
                            <SelectItem value="high">{dict.tasks?.priority_high || "High"}</SelectItem>
                        </SelectContent>
                    </Select>
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
