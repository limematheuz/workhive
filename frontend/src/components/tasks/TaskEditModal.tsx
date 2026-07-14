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
    editTitle: string;
    setEditTitle: (val: string) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    editDescription: string;
    setEditDescription: (val: string) => void;
    editPrice: string;
    setEditPrice: (val: string) => void;
    editQuantity: string;
    setEditQuantity: (val: string) => void;
    editUnit: string;
    setEditUnit: (val: string) => void;
    editLocationId: string;
    setEditLocationId: (val: string) => void;
    editUserId: string;
    editStatus: TaskStatus;
    setEditStatus: (val: TaskStatus) => void;
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
    onAccept?: (taskId: number, scheduledStartAt?: string) => Promise<void> | void;
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
    editTitle,
    setEditTitle,
    editNotes,
    setEditNotes,
    editDescription,
    setEditDescription,
    editPrice,
    setEditPrice,
    editQuantity,
    setEditQuantity,
    editUnit,
    setEditUnit,
    editLocationId,
    setEditLocationId,
    editUserId,
    editStatus,
    setEditStatus,
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
    const calendarAssigneeName = editUserId
        ? getAssigneeName(parseInt(editUserId, 10))
        : "Administrador del calendario";

    return (
        <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
            <DialogContent
                className={cn(
                    "flex max-h-[min(90vh,820px)] w-[95vw] flex-col gap-0 overflow-hidden border-[var(--border-soft)] bg-[var(--bg-card)] p-0 sm:max-w-2xl md:max-w-3xl [scrollbar-width:none]",
                    selectedTask?.status === "requested" && "border-t-[3px] border-t-accent"
                )}
            >
                <DialogHeader className="shrink-0 space-y-1 border-b border-[var(--border-soft)] px-5 py-4 pr-16 text-left sm:px-6">
                    <span className={cn(
                        "block text-[10px] font-black uppercase tracking-wider",
                        selectedTask?.status === "requested" ? "text-accent" : "text-[var(--text-muted)]"
                    )}>
                        {selectedTask?.status === "requested"
                            ? "Solicitud externa"
                            : (dict.tasks?.dialog?.details_title_simple || "Task Details")}
                    </span>
                    <DialogTitle className="text-lg font-black leading-snug text-[var(--text-main)] sm:text-xl">
                        {displayTitle}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Task details
                    </DialogDescription>
                </DialogHeader>

                {selectedTask && (
                    selectedTask.status === "requested" ? (
                        <TaskRequestReview
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
                            calendarAssigneeName={calendarAssigneeName}
                            currentUser={currentUser}
                            dict={dict}
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
