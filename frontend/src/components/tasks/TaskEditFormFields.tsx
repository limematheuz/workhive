"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    assignTaskChecklistItem,
    toggleTaskChecklistItem,
} from "@/lib/task-checklist";
import { localizeTaskDescription } from "@/lib/task-display";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { User } from "@/types/user";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";
import { TaskChecklistEditor } from "./TaskChecklistEditor";
import { TaskPricingAgreementSection } from "./TaskEditPricingSection";
import { TaskEditStatusSection } from "./TaskEditStatusSection";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";
import { resolveTaskEditChecklist } from "@/lib/resolve-task-edit-checklist";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
    taskFormTextAreaClass,
} from "./taskFormLayout";

type TaskEditFormFieldsProps = {
    dict: Dictionary;
    editCreatedAt: string;
    editDescription: string;
    editLocationId: string;
    editNotes: string;
    editPlanningTime: string;
    editPrice: string;
    editPricingMode: TaskPricingMode;
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
    setEditPricingMode: (value: TaskPricingMode) => void;
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
        editCreatedAt,
        editDescription,
        editLocationId,
        editNotes,
        editPlanningTime,
        editPrice,
        editPricingMode,
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
        setEditPricingMode,
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

    const assignWorkerToAllItems = (userId: string) => {
        const targetUser = users.find((user) => user.id.toString() === userId);
        const assignedName = targetUser?.full_name || targetUser?.email || "";
        setEditDescription(
            checklist.reduce(
                (description, item) => assignTaskChecklistItem(description, item.index, userId, assignedName),
                editDescription,
            ),
        );
    };

    const handlePricingModeChange = (mode: TaskPricingMode) => {
        setEditPricingMode(mode);
        if (mode === "hourly") {
            setEditUnit("hour");
        }
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
                        <Input
                            id="task-edit-title"
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            disabled={!managerEditable || isReceiverCompany}
                            className={taskFormControlClass}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-location" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.location_label || "Location"}
                        </label>
                        <Input
                            id="task-edit-location"
                            readOnly
                            value={locations.find((location) => location.id.toString() === editLocationId)?.name || ""}
                            className={taskFormControlClass}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-date" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.date_label || "Planned date"}
                        </label>
                        <DatePicker
                            id="task-edit-date"
                            value={editCreatedAt}
                            min={getDefaultTaskDate()}
                            max={maxPlanningDate}
                            onValueChange={setEditCreatedAt}
                            disabled={!managerEditable}
                            className={taskFormControlClass}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-time" className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.label_time || "Time"}
                        </label>
                        <Input
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
                        onAssignAll={assignWorkerToAllItems}
                    />
                ) : (
                    <Textarea
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
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-edit-notes" className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.internal_notes || "Internal notes"}
                        </label>
                        <Textarea
                            id="task-edit-notes"
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            disabled={!managerEditable}
                            rows={3}
                            placeholder="Añade información interna de la tarea..."
                            className={taskFormTextAreaClass}
                        />
                    </div>
                </section>
            )}

            <TaskPricingAgreementSection
                dict={dict}
                managerEditable={managerEditable}
                price={editPrice}
                pricingLocked={Boolean(selectedTask.pricing_locked_at)}
                pricingMode={editPricingMode}
                quantity={editQuantity}
                snapshotSeconds={selectedTask.worked_seconds_snapshot}
                unit={editUnit}
                onPriceChange={setEditPrice}
                onPricingModeChange={handlePricingModeChange}
                onQuantityChange={setEditQuantity}
                onUnitChange={setEditUnit}
            />

            <TaskEditStatusSection
                dict={dict}
                isReceiverCompany={isReceiverCompany}
                managerEditable={managerEditable}
                priority={editPriority}
                selectedTask={selectedTask}
                status={editStatus}
                onPriorityChange={setEditPriority}
                onStatusChange={setEditStatus}
            />
        </>
    );
}
