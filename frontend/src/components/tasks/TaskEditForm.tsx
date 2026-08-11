"use client";

import React from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { User } from "@/types/user";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";
import { TaskEditFormAlerts } from "./TaskEditFormAlerts";
import { TaskEditFormFields } from "./TaskEditFormFields";
import { TaskEditFormActions } from "./TaskEditFormActions";

interface TaskEditFormProps {
    currentUser: User | null;
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
    handleDeleteTask: (task: TaskItem) => void;
    handleDuplicateTask: (task: TaskItem) => Promise<void>;
    handleSaveTaskDetails: (event: React.FormEvent) => void;
    adminOrManager: boolean;
    deletingTask: boolean;
    receiverCompany: boolean;
    saving: boolean;
    locations: Location[];
    maxPlanningDate?: string;
    selectedTask: TaskItem;
    setEditCreatedAt: (value: string) => void;
    setEditDescription: (value: string) => void;
    setEditLocationId: (value: string) => void;
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
}

export function TaskEditForm({
    currentUser,
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
    handleDeleteTask,
    handleDuplicateTask,
    handleSaveTaskDetails,
    adminOrManager,
    deletingTask,
    receiverCompany,
    saving,
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
}: TaskEditFormProps) {
    const immutable = selectedTask.is_invoiced;
    const managerEditable = !immutable && adminOrManager;

    return (
        <form
            onSubmit={managerEditable ? handleSaveTaskDetails : event => event.preventDefault()}
            className="flex min-h-0 flex-1 flex-col font-sans"
        >
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:p-6">
                <TaskEditFormAlerts
                    dict={dict}
                    immutable={immutable}
                    isAdminOrManager={adminOrManager}
                />

                <TaskEditFormFields
                    dict={dict}
                    editCreatedAt={editCreatedAt}
                    editDescription={editDescription}
                    editLocationId={editLocationId}
                    editNotes={editNotes}
                    editPlanningTime={editPlanningTime}
                    editPrice={editPrice}
                    editPricingMode={editPricingMode}
                    editPriority={editPriority}
                    editQuantity={editQuantity}
                    editStatus={editStatus}
                    editTitle={editTitle}
                    editUnit={editUnit}
                    isReceiverCompany={receiverCompany}
                    managerEditable={managerEditable}
                    locations={locations}
                    maxPlanningDate={maxPlanningDate}
                    selectedTask={selectedTask}
                    setEditCreatedAt={setEditCreatedAt}
                    setEditDescription={setEditDescription}
                    setEditNotes={setEditNotes}
                    setEditPlanningTime={setEditPlanningTime}
                    setEditPrice={setEditPrice}
                    setEditPricingMode={setEditPricingMode}
                    setEditPriority={setEditPriority}
                    setEditQuantity={setEditQuantity}
                    setEditStatus={setEditStatus}
                    setEditTitle={setEditTitle}
                    setEditUnit={setEditUnit}
                    users={users}
                    isAdminOrManager={adminOrManager}
                    immutable={immutable}
                />
            </div>

            <TaskEditFormActions
                dict={dict}
                currentUser={currentUser}
                selectedTask={selectedTask}
                immutable={immutable}
                managerEditable={managerEditable}
                adminOrManager={adminOrManager}
                receiverCompany={receiverCompany}
                deletingTask={deletingTask}
                saving={saving}
                handleDeleteTask={handleDeleteTask}
                handleDuplicateTask={handleDuplicateTask}
            />
        </form>
    );
}
