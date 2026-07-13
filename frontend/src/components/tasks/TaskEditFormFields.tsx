"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import {
    assignTaskChecklistItem,
    parseTaskChecklist,
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

type TaskEditFormFieldsProps = {
    dict: Dictionary;
    calendarAssigneeName: string;
    displayTitle: string;
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
    setEditUnit: (value: string) => void;
    users: User[];
    isAdminOrManager: boolean;
    immutable: boolean;
};

export function TaskEditFormFields(props: TaskEditFormFieldsProps) {
    const {
        dict,
        calendarAssigneeName,
        displayTitle,
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
        setEditUnit,
        users,
        isAdminOrManager,
        immutable,
    } = props;

    const localizedDescription = localizeTaskDescription(editDescription) || "";
    const checklist = parseTaskChecklist(localizedDescription);

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
            <div className="space-y-1">
                <span className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                    {dict.tasks?.dialog?.title_label || "Title"}
                </span>
                <div className="min-h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-semibold text-[var(--text-main)]">
                    {isReceiverCompany ? displayTitle : editTitle}
                </div>
            </div>

            <div className="space-y-1">
                <label htmlFor="task-edit-description" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                    Descripción
                </label>
                <textarea
                    id="task-edit-description"
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    disabled={!managerEditable || isReceiverCompany}
                    rows={3}
                    placeholder="Añade información interna de la tarea..."
                    className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
            </div>

            <div className="space-y-1.5">
                {checklist.length > 0 ? (
                    <span className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        Checklist / Instrucciones
                    </span>
                ) : (
                    <label htmlFor="task-edit-checklist" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        Checklist / Instrucciones
                    </label>
                )}
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
                        aria-label="Checklist / Instrucciones"
                        className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    />
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                    <span className="text-2xs mb-0.5 block font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.location_label || "Installation / Location"}
                    </span>
                    <div className="flex h-9 w-full items-center truncate rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]">
                        {locations.find((location) => location.id.toString() === editLocationId)?.name || ""}
                    </div>
                </div>

                <div className="space-y-1">
                    <span className="text-2xs mb-0.5 block font-bold uppercase text-[var(--text-muted)]">
                        Calendario
                    </span>
                    <div className="flex h-9 w-full cursor-not-allowed items-center truncate rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-muted)] opacity-80">
                        {calendarAssigneeName}
                    </div>
                </div>

                <div className="space-y-1">
                    <label htmlFor="task-edit-date" className="text-2xs mb-0.5 block font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.date_label || "Planning Date"}
                    </label>
                    <input
                        id="task-edit-date"
                        type="date"
                        value={editCreatedAt}
                        min={getDefaultTaskDate()}
                        onChange={(event) => setEditCreatedAt(event.target.value)}
                        aria-label={dict.tasks?.dialog?.date_label || "Planning Date"}
                        disabled={!managerEditable}
                        max={maxPlanningDate}
                        className="h-9 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="task-edit-time" className="text-2xs mb-0.5 block font-bold uppercase text-[var(--text-muted)]">
                        Hora
                    </label>
                    <input
                        id="task-edit-time"
                        type="time"
                        value={editPlanningTime}
                        onChange={(event) => setEditPlanningTime(event.target.value)}
                        aria-label="Hora"
                        disabled={!managerEditable}
                        className="h-9 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>
            </div>

            {!isReceiverCompany && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label htmlFor="task-edit-price" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.price_label || "Price (€)"}
                        </label>
                        <input
                            id="task-edit-price"
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(event) => setEditPrice(event.target.value)}
                            aria-label={dict.tasks?.dialog?.price_label || "Price (€)"}
                            disabled={!managerEditable}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="task-edit-quantity" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.quantity_label || "Quantity"}
                        </label>
                        <input
                            id="task-edit-quantity"
                            type="number"
                            step="0.1"
                            value={editQuantity}
                            onChange={(event) => setEditQuantity(event.target.value)}
                            aria-label={dict.tasks?.dialog?.quantity_label || "Quantity"}
                            disabled={!managerEditable}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="task-edit-unit" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.unit_label || "Unit"}
                        </label>
                        <select
                            id="task-edit-unit"
                            value={editUnit}
                            onChange={(event) => setEditUnit(event.target.value)}
                            aria-label={dict.tasks?.dialog?.unit_label || "Unit"}
                            disabled={!managerEditable}
                            required
                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {TASK_EDIT_UNIT_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-soft)] pt-2 sm:grid-cols-3">
                <div className="space-y-1">
                    <label htmlFor="task-edit-status" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.status_label || "Status"}
                    </label>
                    <select
                        id="task-edit-status"
                        value={editStatus}
                        onChange={(event) => setEditStatus(event.target.value as TaskStatus)}
                        aria-label={dict.tasks?.dialog?.status_label || "Status"}
                        disabled={!managerEditable}
                        className="h-9 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="pending">{dict.tasks?.dialog?.status_pending || "Pending"}</option>
                        <option value="accepted">{dict.tech?.status_accepted || "Accepted"}</option>
                        <option value="rejected">{dict.tech?.status_rejected || "Rejected"}</option>
                        <option value="progress">{dict.tasks?.dialog?.status_progress || "In progress"}</option>
                        <option value="review">{dict.tasks?.dialog?.status_review || "In Review"}</option>
                        <option value="completed">{dict.tasks?.dialog?.status_completed || "Completed"}</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="task-edit-priority" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.priority_label || "Priority"}
                    </label>
                    <select
                        id="task-edit-priority"
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                        aria-label={dict.tasks?.priority_label || "Priority"}
                        disabled={!managerEditable || isReceiverCompany}
                        className="h-9 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="low">{dict.tasks?.priority_low || "Low"}</option>
                        <option value="medium">{dict.tasks?.priority_medium || "Medium"}</option>
                        <option value="high">{dict.tasks?.priority_high || "High"}</option>
                    </select>
                </div>

                <div className="text-2xs flex flex-col justify-end pb-1 font-mono font-medium text-[var(--text-muted)]">
                    <div>
                        {dict.tasks?.dialog?.created_at || "Created:"}{" "}
                        {new Date(selectedTask.created_at).toLocaleString("en-US", {
                            timeZone: "UTC",
                        })}
                    </div>
                    {selectedTask.date_done && (
                        <div className="mt-1">
                            {dict.tasks?.dialog?.finished_at || "Finished:"}{" "}
                            {new Date(selectedTask.date_done).toLocaleString("en-US", {
                                timeZone: "UTC",
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
