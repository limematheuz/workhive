"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { TasksRequests } from "@/components/tasks/TasksRequests";
import type { useTaskCrud } from "@/hooks/useTaskCrud";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";
import type { TaskItem } from "@/services/task.service";
import type { User } from "@/types/user";

type ReservationsRequestsSectionProps = {
    showRequestsList: boolean;
    loadingTasks: boolean;
    requests: TaskItem[];
    locations: Location[];
    dict: Dictionary;
    user: User | null;
    users: User[];
    canManage: boolean;
    taskCrud: ReturnType<typeof useTaskCrud>;
    getLocationName: (locationId: number) => string;
    getAssigneeName: (userId: number | null) => string;
    onAccept: (taskId: number, scheduledStartAt?: string) => Promise<void>;
    onReject: (taskId: number) => Promise<void>;
    onOpenTaskDetail: (task: TaskItem) => void;
};

export function ReservationsRequestsSection({
    showRequestsList,
    loadingTasks,
    requests,
    locations,
    dict,
    user,
    users,
    canManage,
    taskCrud,
    getLocationName,
    getAssigneeName,
    onAccept,
    onReject,
    onOpenTaskDetail,
}: ReservationsRequestsSectionProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    return (
        <>
            {showRequestsList ? (
                loadingTasks ? (
                    <div className="py-20 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    </div>
                ) : (
                    <TasksRequests
                        requests={requests}
                        locations={locations}
                        getLocationName={getLocationName}
                        onAccept={onOpenTaskDetail}
                        onReject={onReject}
                    />
                )
            ) : null}

            <TaskEditModal
                dict={dict}
                currentUser={user}
                locations={locations}
                users={users}
                adminOrManager={canManage}
                saving={taskCrud.isSaving}
                deletingTask={taskCrud.isDeletingTask}
                selectedTask={taskCrud.selectedTask}
                setSelectedTask={(task) => {
                    if (task === null) {
                        taskCrud.setSelectedTask(null);
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("taskId");
                        router.replace(`${pathname}?${params.toString()}`);
                    } else {
                        taskCrud.setSelectedTask(task);
                    }
                }}
                editNotes={taskCrud.editNotes}
                setEditNotes={taskCrud.setEditNotes}
                editDescription={taskCrud.editDescription}
                setEditDescription={taskCrud.setEditDescription}
                editPrice={taskCrud.editPrice}
                setEditPrice={taskCrud.setEditPrice}
                editQuantity={taskCrud.editQuantity}
                setEditQuantity={taskCrud.setEditQuantity}
                editUnit={taskCrud.editUnit}
                setEditUnit={taskCrud.setEditUnit}
                editLocationId={taskCrud.editLocationId}
                setEditLocationId={taskCrud.setEditLocationId}
                editUserId={taskCrud.editUserId}
                editStatus={taskCrud.editStatus}
                setEditStatus={taskCrud.setEditStatus}
                editTitle={taskCrud.editTitle}
                setEditTitle={taskCrud.setEditTitle}
                editPriority={taskCrud.editPriority}
                setEditPriority={taskCrud.setEditPriority}
                editCreatedAt={taskCrud.editCreatedAt}
                setEditCreatedAt={taskCrud.setEditCreatedAt}
                editPlanningTime={taskCrud.editPlanningTime}
                setEditPlanningTime={taskCrud.setEditPlanningTime}
                handleSaveTaskDetails={taskCrud.handleSaveTaskDetails}
                handleDeleteTask={taskCrud.handleDeleteTask}
                handleDuplicateTask={taskCrud.handleDuplicateTask}
                getAssigneeName={getAssigneeName}
                onAccept={onAccept}
                onReject={onReject}
            />

            <DeleteConfirmDialog
                open={taskCrud.isDeleteTaskDialogOpen}
                onOpenChange={taskCrud.setIsDeleteTaskDialogOpen}
                title={dict.tasks?.delete_confirm_dialog?.title || "Eliminar Tarea"}
                description={
                    dict.tasks?.delete_confirm_dialog?.description
                        ? dict.tasks.delete_confirm_dialog.description.replace(
                              "{title}",
                              taskCrud.taskToDelete?.title || "",
                          )
                        : `¿Estás seguro de que deseas eliminar la tarea "${
                              taskCrud.taskToDelete?.title || ""
                          }"? Esta acción no se puede deshacer.`
                }
                onConfirm={taskCrud.handleDeleteTaskConfirm}
                isDeleting={taskCrud.isDeletingTask}
                confirmText={dict.tasks?.delete_confirm_dialog?.confirm || "Eliminar"}
                cancelText={dict.tasks?.delete_confirm_dialog?.cancel || "Cancelar"}
            />
        </>
    );
}
