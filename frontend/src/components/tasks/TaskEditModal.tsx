"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { TaskEditForm } from "./TaskEditForm";
import { TaskRequestReview } from "./TaskRequestReview";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    isExternalTaskForCompany,
    localizeTaskDescription,
    taskLocationTitle,
} from "@/lib/task-display";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";
import type { TaskAcceptanceInput } from "@/domain/tasks/task-acceptance";
import {
    taskDialogContentClass,
    taskDialogHeaderClass,
    taskDialogOverlayClass,
} from "./taskDialogChrome";

interface TaskEditModalProps {
    dict: Dictionary;
    currentUser: User | null;
    locations: Location[];
    users: User[];
    adminOrManager: boolean;
    saving: boolean;
    deletingTask: boolean;
    selectedTask: TaskItem | null;
    setSelectedTask: (task: TaskItem | null) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    editDescription: string;
    setEditDescription: (val: string) => void;
    editPrice: string;
    setEditPrice: (val: string) => void;
    editPricingMode: TaskPricingMode;
    setEditPricingMode: (val: TaskPricingMode) => void;
    editQuantity: string;
    setEditQuantity: (val: string) => void;
    editUnit: string;
    setEditUnit: (val: string) => void;
    editLocationId: string;
    setEditLocationId: (val: string) => void;
    editUserId?: string;
    editStatus: TaskStatus;
    setEditStatus: (val: TaskStatus) => void;
    editTitle: string;
    setEditTitle: (val: string) => void;
    editPriority: TaskPriority;
    setEditPriority: (val: TaskPriority) => void;
    handleSaveTaskDetails: (e: React.FormEvent) => void;
    handleDeleteTask: (task: TaskItem) => void;
    handleDuplicateTask: (task: TaskItem) => Promise<void>;
    getAssigneeName: (userId: number | null) => string;
    editCreatedAt: string;
    setEditCreatedAt: (val: string) => void;
    editPlanningTime: string;
    setEditPlanningTime: (val: string) => void;
    onAccept?: (taskId: number, input: TaskAcceptanceInput) => Promise<void> | void;
    onReject?: (taskId: number) => Promise<void> | void;
}

export function TaskEditModal({
    dict,
    currentUser,
    locations,
    users,
    adminOrManager,
    saving,
    deletingTask,
    selectedTask,
    setSelectedTask,
    editNotes,
    setEditNotes,
    editDescription,
    setEditDescription,
    editPrice,
    setEditPrice,
    editPricingMode,
    setEditPricingMode,
    editQuantity,
    setEditQuantity,
    editUnit,
    setEditUnit,
    editLocationId,
    setEditLocationId,
    editStatus,
    setEditStatus,
    editTitle,
    setEditTitle,
    editPriority,
    setEditPriority,
    handleSaveTaskDetails,
    handleDeleteTask,
    handleDuplicateTask,
    getAssigneeName,
    editCreatedAt,
    setEditCreatedAt,
    editPlanningTime,
    setEditPlanningTime,
    onAccept,
    onReject,
}: TaskEditModalProps) {
    const isReceiverCompany = React.useMemo(() => {
        if (!selectedTask || !currentUser) return false;
        if (selectedTask.status === "requested") return true;
        return isExternalTaskForCompany(selectedTask, currentUser.company_id);
    }, [selectedTask, currentUser]);

    const maxPlanningDate = React.useMemo(() => {
        if (selectedTask?.next_reservation?.check_in_at) {
            return selectedTask.next_reservation.check_in_at.split("T")[0];
        }
        return undefined;
    }, [selectedTask]);

    const selectedLocation = selectedTask
        ? locations.find((location) => location.id === selectedTask.location_id)
        : undefined;
    const localizedDescription = localizeTaskDescription(editDescription) || "";
    const displayTitle = selectedTask
        ? taskLocationTitle(selectedTask, selectedLocation?.name || "")
        : "";
    return (
        <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
            <DialogContent
                overlayClassName={taskDialogOverlayClass}
                className={cn(
                    taskDialogContentClass,
                    "max-h-[min(90vh,820px)] sm:max-w-2xl md:max-w-3xl",
                    selectedTask?.status === "requested" &&
                        "!border-t-[3px] !border-t-[var(--accent-color)]"
                )}
            >
                <DialogHeader className={taskDialogHeaderClass}>
                    <span className={cn(
                        "block text-[10px] font-bold uppercase tracking-[0.14em]",
                        selectedTask?.status === "requested" ? "text-accent" : "text-[var(--text-muted)]"
                    )}>
                        {selectedTask?.status === "requested"
                            ? "Solicitud externa"
                            : (dict.tasks?.dialog?.details_title_simple || "Task Details")}
                    </span>
                    <DialogTitle className="text-lg font-bold leading-snug tracking-tight text-[var(--text-main)] sm:text-xl">
                        {displayTitle}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Task details
                    </DialogDescription>
                </DialogHeader>

                {selectedTask && (
                    selectedTask.status === "requested" ? (
                        <TaskRequestReview
                            key={selectedTask.id}
                            dict={dict}
                            task={selectedTask}
                            location={selectedLocation}
                            isAdminOrManager={adminOrManager}
                            isSaving={saving}
                            description={localizedDescription}
                            planningDate={editCreatedAt}
                            planningTime={editPlanningTime}
                            maxPlanningDate={maxPlanningDate}
                            assigneeName={getAssigneeName(selectedTask.user_id)}
                            onPlanningDateChange={setEditCreatedAt}
                            onPlanningTimeChange={setEditPlanningTime}
                            onAccept={onAccept}
                            onReject={onReject}
                            onClose={() => setSelectedTask(null)}
                        />
                    ) : (
                        <TaskEditForm
                            currentUser={currentUser}
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
                            handleDeleteTask={handleDeleteTask}
                            handleDuplicateTask={handleDuplicateTask}
                            handleSaveTaskDetails={handleSaveTaskDetails}
                            adminOrManager={adminOrManager}
                            deletingTask={deletingTask}
                            receiverCompany={isReceiverCompany}
                            saving={saving}
                            locations={locations}
                            maxPlanningDate={maxPlanningDate}
                            selectedTask={selectedTask}
                            setEditCreatedAt={setEditCreatedAt}
                            setEditDescription={setEditDescription}
                            setEditLocationId={setEditLocationId}
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
                        />
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
