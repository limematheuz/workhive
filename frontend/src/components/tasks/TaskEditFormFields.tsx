"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import {
    assignTaskChecklistItem,
    toggleTaskChecklistItem,
} from "@/lib/task-checklist";
import { localizeTaskDescription } from "@/lib/task-display";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { User } from "@/types/user";
import { TaskChecklistEditor } from "./TaskChecklistEditor";
import { TASK_EDIT_UNIT_OPTIONS } from "./taskEditFormOptions";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";
import { resolveTaskEditChecklist } from "@/lib/resolve-task-edit-checklist";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormReadOnlyClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
    taskFormTextAreaClass,
} from "./taskFormLayout";

type TaskEditFormFieldsProps = {
    dict: Dictionary;
    calendarAssigneeName: string;
    editCreatedAt: string;
    editDescription: string;
    editLocationId: string;
    editNotes: string;
    editPlanningTime: string;
    editPrice: string;
    editPriority: TaskPriority;
    editQuantity: string;
    editStatus: TaskStatus;
    editTitle: string;
    editUnit: string;
    isReceiverCompany: boolean;
    managerEditable: boolean;
    locations: Location[];
    maxPlanningDate?: string;
    selectedTask: TaskItem;
    setEditCreatedAt: (value: string) => void;
    setEditDescription: (value: string) => void;
    setEditNotes: (value: string) => void;
    setEditPlanningTime: (value: string) => void;
    setEditPrice: (value: string) => void;
    setEditPriority: (value: TaskPriority) => void;
    setEditQuantity: (value: string) => void;
    setEditStatus: (value: TaskStatus) => void;
    setEditTitle: (value: string) => void;
    setEditUnit: (value: string) => void;
    users: User[];
    isAdminOrManager: boolean;
    immutable: boolean;
};

export function TaskEditFormFields(props: TaskEditFormFieldsProps) {
    const {
        dict,
        calendarAssigneeName,
        editCreatedAt,
        editDescription,
        editLocationId,
        editNotes,
        editPlanningTime,
        editPrice,
        editPriority,
        editQuantity,
        editStatus,
        editTitle,
        editUnit,
        isReceiverCompany,
        managerEditable,
        locations,
        maxPlanningDate,
        selectedTask,
        setEditCreatedAt,
        setEditDescription,
        setEditNotes,
        setEditPlanningTime,
        setEditPrice,
        setEditPriority,
        setEditQuantity,
        setEditStatus,
        setEditTitle,
        setEditUnit,
        users,
        isAdminOrManager,
        immutable,
    } = props;

    const localizedDescription = localizeTaskDescription(editDescription) || "";
    const checklist = resolveTaskEditChecklist(localizedDescription, selectedTask);

    const toggleChecklistItem = (itemIndex: number) => {
        setEditDescription(toggleTaskChecklistItem(editDescription, itemIndex));
    };

    const assignWorkerToItem = (itemIndex: number, userId: string) => {
        const targetUser = users.find((user) => user.id.toString() === userId);
        setEditDescription(
            assignTaskChecklistItem(
                editDescription,
                itemIndex,
                userId,
                targetUser?.full_name || targetUser?.email || "",
            ),
        );
    };

    return (
        <>
            <section className={taskFormSectionClass}>
                <div className={taskFormSectionHeaderClass}>
                    <h3 className={taskFormSectionTitleClass}>
                        {dict.tasks?.create_dialog?.task_details_section || "Service details"}
                    </h3>
                    <p className={taskFormSectionHintClass}>
                        {dict.tasks?.create_dialog?.task_details_section_hint
                            || "Review planning, instructions and internal details before saving."}
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <label htmlFor="task-edit-title" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.title_label || "Title"}
                        </label>
                        <input
                            id="task-edit-title"
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            disabled={!managerEditable || isReceiverCompany}
                            className={taskFormControlClass}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <span className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.location_label || "Location"}
                        </span>
                        <div className={taskFormReadOnlyClass}>
                            {locations.find((location) => location.id.toString() === editLocationId)?.name || ""}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <span className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.calendar_owner || "Company calendar"}
                        </span>
                        <div className={taskFormReadOnlyClass}>{calendarAssigneeName}</div>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-date" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.date_label || "Planned date"}
                        </label>
                        <input
                            id="task-edit-date"
                            type="date"
                            value={editCreatedAt}
                            min={getDefaultTaskDate()}
                            max={maxPlanningDate}
                            onChange={(event) => setEditCreatedAt(event.target.value)}
                            disabled={!managerEditable}
                            className={`${taskFormControlClass} cursor-pointer`}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-time" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.label_time || "Time"}
                        </label>
                        <input
                            id="task-edit-time"
                            type="time"
                            value={editPlanningTime}
                            onChange={(event) => setEditPlanningTime(event.target.value)}
                            disabled={!managerEditable}
                            className={`${taskFormControlClass} cursor-pointer`}
                        />
                    </div>
                </div>
            </section>

            <section className={taskFormSectionClass}>
                <div className={taskFormSectionHeaderClass}>
                    <h3 className={taskFormSectionTitleClass}>
                        {dict.tasks?.create_dialog?.checklist || "Checklist and instructions"}
                    </h3>
                    <p className={taskFormSectionHintClass}>
                        {dict.tasks?.create_dialog?.services_section_hint
                            || "Select fixed work, review steps and assign owners."}
                    </p>
                </div>
                {checklist.length > 0 ? (
                    <TaskChecklistEditor
                        items={checklist}
                        users={users}
                        canEdit={!immutable && isAdminOrManager}
                        onToggle={toggleChecklistItem}
                        onAssign={assignWorkerToItem}
                    />
                ) : (
                    <textarea
                        id="task-edit-checklist"
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        disabled={!managerEditable}
                        rows={4}
                        aria-label={dict.tasks?.create_dialog?.checklist || "Checklist and instructions"}
                        className={taskFormTextAreaClass}
                    />
                )}
            </section>

            {!isReceiverCompany && (
                <section className={taskFormSectionClass}>
                    <div className={taskFormSectionHeaderClass}>
                        <h3 className={taskFormSectionTitleClass}>
                            {dict.tasks?.create_dialog?.internal_notes || "Internal notes"}
                        </h3>
                        <p className={taskFormSectionHintClass}>
                            {dict.tasks?.create_dialog?.task_details_section_hint
                                || "Review planning, instructions and internal details before saving."}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-notes" className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.internal_notes || "Internal notes"}
                        </label>
                        <textarea
                            id="task-edit-notes"
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            disabled={!managerEditable}
                            rows={3}
                            placeholder="Añade información interna de la tarea..."
                            className={taskFormTextAreaClass}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <label htmlFor="task-edit-price" className={taskFormLabelClass}>
                                {dict.tasks?.dialog?.price_label || "Price (€)"}
                            </label>
                            <input
                                id="task-edit-price"
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={(event) => setEditPrice(event.target.value)}
                                disabled={!managerEditable}
                                className={`${taskFormControlClass} font-mono`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="task-edit-quantity" className={taskFormLabelClass}>
                                {dict.tasks?.dialog?.quantity_label || "Quantity"}
                            </label>
                            <input
                                id="task-edit-quantity"
                                type="number"
                                step="0.1"
                                value={editQuantity}
                                onChange={(event) => setEditQuantity(event.target.value)}
                                disabled={!managerEditable}
                                className={`${taskFormControlClass} font-mono`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="task-edit-unit" className={taskFormLabelClass}>
                                {dict.tasks?.dialog?.unit_label || "Unit"}
                            </label>
                            <select
                                id="task-edit-unit"
                                value={editUnit}
                                onChange={(event) => setEditUnit(event.target.value)}
                                disabled={!managerEditable}
                                required
                                className={taskFormControlClass}
                            >
                                {TASK_EDIT_UNIT_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>
            )}

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
                            value={editStatus}
                            onChange={(event) => setEditStatus(event.target.value as TaskStatus)}
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
                            value={editPriority}
                            onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
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
        </>
    );
}
