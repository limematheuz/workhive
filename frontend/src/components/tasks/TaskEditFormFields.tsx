"use client";

import { ChevronDown } from "lucide-react";
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

type TaskEditFormFieldsProps = {
    dict: Dictionary;
    editCreatedAt: string;
    editDescription: string;
    editLocationId: string;
    editNotes: string;
    editPlanningTime: string;
    editPrice: string;
    editPriority: TaskPriority;
    editQuantity: string;
    editStatus: TaskStatus;
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
        editCreatedAt,
        editDescription,
        editLocationId,
        editNotes,
        editPlanningTime,
        editPrice,
        editPriority,
        editQuantity,
        editStatus,
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
    const assignWorkerToAllItems = (userId: string) => {
        const targetUser = users.find((user) => user.id.toString() === userId);
        setEditDescription(checklist.reduce(
            (description, item) => assignTaskChecklistItem(description, item.index, userId, targetUser?.full_name || targetUser?.email || ""),
            editDescription,
        ));
    };

    return (
        <>
            <details className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/15 p-3" open={Boolean(editNotes)}>
                <summary className="cursor-pointer text-xs font-black text-[var(--text-main)]">Notas internas <span className="ml-1 font-medium text-[var(--text-muted)]">(opcional)</span></summary>
                <textarea
                    id="task-edit-description"
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    disabled={!managerEditable || isReceiverCompany}
                    rows={3}
                    placeholder="Indicaciones internas para el equipo"
                    className="mt-3 w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
            </details>

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
                        onAssignAll={assignWorkerToAllItems}
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

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/15 p-3.5">
            <p className="mb-3 text-xs font-black text-[var(--text-main)]">Planificación</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.8fr)_minmax(8rem,0.65fr)]">
                <div className="space-y-1">
                    <span className="text-2xs mb-0.5 block font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.location_label || "Installation / Location"}
                    </span>
                    <div className="flex h-9 w-full items-center truncate rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]">
                        {locations.find((location) => location.id.toString() === editLocationId)?.name || ""}
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
            </section>

            {!isReceiverCompany && (
                <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/15 p-3.5">
                    <p className="mb-3 text-xs font-black text-[var(--text-main)]">Coste del servicio</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                        <label htmlFor="task-edit-price" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.price_label || "Precio (€)"}
                        </label>
                        <input
                            id="task-edit-price"
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(event) => setEditPrice(event.target.value)}
                            aria-label={dict.tasks?.dialog?.price_label || "Price (€)"}
                            disabled={!managerEditable}
                            className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="task-edit-quantity" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.quantity_label || "Cantidad"}
                        </label>
                        <input
                            id="task-edit-quantity"
                            type="number"
                            step="0.1"
                            value={editQuantity}
                            onChange={(event) => setEditQuantity(event.target.value)}
                            aria-label={dict.tasks?.dialog?.quantity_label || "Quantity"}
                            disabled={!managerEditable}
                            className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="task-edit-unit" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                            {dict.tasks?.dialog?.unit_label || "Unidad"}
                        </label>
                        <div className="relative">
                        <select
                            id="task-edit-unit"
                            value={editUnit}
                            onChange={(event) => setEditUnit(event.target.value)}
                            aria-label={dict.tasks?.dialog?.unit_label || "Unit"}
                            disabled={!managerEditable}
                            required
                            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 pr-10 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {TASK_EDIT_UNIT_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        </div>
                    </div>
                </div>
                </section>
            )}

            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/15 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="space-y-1">
                    <label htmlFor="task-edit-status" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.status_label || "Estado"}
                    </label>
                    <div className="relative">
                    <select
                        id="task-edit-status"
                        value={editStatus}
                        onChange={(event) => setEditStatus(event.target.value as TaskStatus)}
                        aria-label={dict.tasks?.dialog?.status_label || "Status"}
                        disabled={!managerEditable}
                        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 pr-10 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="pending">{dict.tasks?.dialog?.status_pending || "Pending"}</option>
                        <option value="accepted">{dict.tech?.status_accepted || "Accepted"}</option>
                        <option value="rejected">{dict.tech?.status_rejected || "Rejected"}</option>
                        <option value="progress">{dict.tasks?.dialog?.status_progress || "In progress"}</option>
                        <option value="review">{dict.tasks?.dialog?.status_review || "In Review"}</option>
                        <option value="completed">{dict.tasks?.dialog?.status_completed || "Completed"}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    </div>
                </div>

                <div className="space-y-1">
                    <label htmlFor="task-edit-priority" className="text-2xs font-bold uppercase text-[var(--text-muted)]">
                        {dict.tasks?.priority_label || "Priority"}
                    </label>
                    <div className="relative">
                    <select
                        id="task-edit-priority"
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                        aria-label={dict.tasks?.priority_label || "Priority"}
                        disabled={!managerEditable || isReceiverCompany}
                        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 pr-10 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="low">{dict.tasks?.priority_low || "Low"}</option>
                        <option value="medium">{dict.tasks?.priority_medium || "Medium"}</option>
                        <option value="high">{dict.tasks?.priority_high || "High"}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    </div>
                </div>

                <div className="text-2xs flex flex-col justify-end pb-1 font-mono font-medium text-[var(--text-muted)]">
                    <div>
                        {dict.tasks?.dialog?.created_at || "Created:"}{" "}
                        {new Date(selectedTask.created_at).toLocaleString("es-ES", {
                            timeZone: "Europe/Madrid",
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}
                    </div>
                    {selectedTask.date_done && (
                        <div className="mt-1">
                            {dict.tasks?.dialog?.finished_at || "Finished:"}{" "}
                            {new Date(selectedTask.date_done).toLocaleString("es-ES", {
                                timeZone: "Europe/Madrid",
                                dateStyle: "medium",
                                timeStyle: "short",
                            })}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
