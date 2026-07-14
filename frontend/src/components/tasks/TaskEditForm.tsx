"use client";

import React from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { User } from "@/types/user";
import { TaskEditFormAlerts } from "./TaskEditFormAlerts";
import { TaskEditFormFields } from "./TaskEditFormFields";
import { TaskEditFormActions } from "./TaskEditFormActions";

interface TaskEditFormProps {
    calendarAssigneeName: string;
    currentUser: User | null;
    dict: Dictionary;
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
    setEditPriority: (value: TaskPriority) => void;
    setEditQuantity: (value: string) => void;
    setEditStatus: (value: TaskStatus) => void;
    setEditTitle: (value: string) => void;
    setEditUnit: (value: string) => void;
    users: User[];
}

export function TaskEditForm({
    calendarAssigneeName,
    currentUser,
    dict,
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
    setEditPriority,
    setEditQuantity,
    setEditStatus,
    setEditUnit,
    users,
}: TaskEditFormProps) {
    const immutable = selectedTask.is_invoiced;
    const managerEditable = !immutable && adminOrManager;

    return (
        <form
            onSubmit={managerEditable ? handleSaveTaskDetails : event => event.preventDefault()}
            className="flex-1 space-y-3 overflow-y-auto p-5 font-sans [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:p-6"
        >
            <TaskEditFormAlerts
                dict={dict}
                immutable={immutable}
                isAdminOrManager={adminOrManager}
            />

            <TaskEditFormFields
                dict={dict}
                calendarAssigneeName={calendarAssigneeName}
                displayTitle={displayTitle}
                editCreatedAt={editCreatedAt}
                editDescription={editDescription}
                editLocationId={editLocationId}
                editNotes={editNotes}
                editPlanningTime={editPlanningTime}
                editPrice={editPrice}
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
                setEditPriority={setEditPriority}
                setEditQuantity={setEditQuantity}
                setEditStatus={setEditStatus}
                setEditUnit={setEditUnit}
                users={users}
                isAdminOrManager={adminOrManager}
                immutable={immutable}
            />

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
