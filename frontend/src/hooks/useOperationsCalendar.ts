"use client";

import { useState, useMemo } from "react";
import { TaskItem, User } from "@/types/user";
import { Location } from "@/types/location";
import { TaskService } from "@/services/task.service";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import React from "react";
import { ShieldAlert } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { canManageCompanyTasks } from "@/domain/access/roles";
import {
    buildScheduledStartAt,
    buildTaskUpdatePayload,
    taskToEditValues,
    type TaskEditValues,
    type TaskPricingMode,
} from "@/domain/tasks/task-edit";
import {
    getScheduleViolation,
    isTaskPlanningDateChangeToPast,
    sortTasksByOperationalPriority,
} from "@/domain/tasks/task-schedule";
import { canMarkEditedTaskCompleted, canMarkTaskCompleted } from "@/lib/task-checklist-completion";
import {
    completionDateForStatus,
    toKanbanStatus,
} from "@/domain/tasks/task-status";
import { canDuplicateTask, canMoveTaskOnKanban } from "@/domain/tasks/task-permissions";
import type { KanbanStatus, TaskPriority, TaskStatus } from "@/types/task";
import { acknowledgeTaskOpened } from "@/components/dashboard/notifications/task-notification-acknowledgement";

export type { KanbanStatus };

interface UseOperationsCalendarParams {
    tasks: TaskItem[];
    locations: Location[];
    users: User[];
    onTaskUpdate: () => void;
    currentUser: User | null;
}

export function useOperationsCalendar({
    tasks,
    locations,
    users,
    onTaskUpdate,
    currentUser,
}: UseOperationsCalendarParams) {
    const { dict } = useDictionary();
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
    const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");
    const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

    // State for the detail/edit modal
    const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
    const [isSavingTask, setIsSavingTask] = useState<boolean>(false);
    const [isDeletingTask, setIsDeletingTask] = useState<boolean>(false);
    const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState<boolean>(false);
    const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

    // Fields of the task editing form in the modal
    const [editTitle, setEditTitle] = useState<string>("");
    const [editNotes, setEditNotes] = useState<string>("");
    const [editDescription, setEditDescription] = useState<string>("");
    const [editPrice, setEditPrice] = useState<string>("");
    const [editPricingMode, setEditPricingMode] = useState<TaskPricingMode>("fixed");
    const [editQuantity, setEditQuantity] = useState<string>("");
    const [editUnit, setEditUnit] = useState<string>("");
    const [editLocationId, setEditLocationId] = useState<string>("");
    const [editUserId, setEditUserId] = useState<string>("");
    const [editStatus, setEditStatus] = useState<TaskStatus>("pending");
    const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
    const [editCreatedAt, setEditCreatedAt] = useState<string>("");
    const [editPlanningTime, setEditPlanningTime] = useState<string>("12:00");

    const isAdminOrManager = canManageCompanyTasks(currentUser);

    // Filter tasks based on search and selects
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            if (task.is_invoiced) return false; // Filter out invoiced tasks from Kanban and operations feed
            if (task.status === "requested" || task.status === "rejected") return false;

            const matchesSearch = searchQuery.trim() === "" ||
                task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesUser = selectedUserId === "ALL" || task.user_id === parseInt(selectedUserId, 10);
            const matchesLocation = selectedLocationId === "ALL" || task.location_id === parseInt(selectedLocationId, 10);

            return matchesSearch && matchesUser && matchesLocation;
        });
    }, [tasks, searchQuery, selectedUserId, selectedLocationId]);

    // Split tasks by Kanban column (no review column)
    const columnsTasks = useMemo(() => {
        const pending: TaskItem[] = [];
        const progress: TaskItem[] = [];
        const completed: TaskItem[] = [];

        filteredTasks.forEach(task => {
            const column = toKanbanStatus(task.status);
            if (column === "completed") completed.push(task);
            else if (column === "progress") progress.push(task);
            else pending.push(task);
        });

        return {
            pending: sortTasksByOperationalPriority(pending),
            progress: sortTasksByOperationalPriority(progress),
            completed: sortTasksByOperationalPriority(completed),
        };
    }, [filteredTasks]);

    // Helpers
    const getUserInitials = (userId: number | null): { initials: string; bgColor: string } => {
        if (userId === null) {
            return { initials: "?", bgColor: "bg-neutral-600" };
        }
        const found = users.find(u => u.id === userId);
        const targetUser = found || (currentUser && currentUser.id === userId ? currentUser : null);

        if (!targetUser) return { initials: "?", bgColor: "bg-neutral-600" };

        const name = targetUser.full_name || targetUser.email;
        const initials = name
            .split(/\s+/)
            .map(p => p[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

        const colors = [
            "bg-accent", "bg-purple-500", "bg-indigo-500",
            "bg-sky-500", "bg-blue-500", "bg-pink-500", "bg-violet-500"
        ];
        const colorIdx = userId % colors.length;
        return { initials, bgColor: colors[colorIdx] };
    };

    const getUserFullName = (userId: number | null): string => {
        if (userId === null) {
            return dict.tasks?.kanban?.unassigned || "Sin asignar";
        }
        const found = users.find(u => u.id === userId);
        if (found) return found.full_name || found.email;
        if (currentUser && currentUser.id === userId) return currentUser.full_name || currentUser.email;
        return dict.tasks?.kanban?.unassigned || "Sin asignar";
    };

    const getLocationName = (locId: number): string => {
        const found = locations.find(l => l.id === locId);
        return found ? found.name : `Installation ID: ${locId}`;
    };

    // Update status of a task
    const handleUpdateStatus = async (taskId: number, newStatus: TaskStatus) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !isAdminOrManager) return;
        if (!canMoveTaskOnKanban(currentUser, task)) {
            toast.error("Cannot move a task that has already been invoiced", {
                icon: React.createElement(ShieldAlert, { className: "w-5 h-5 text-red-500" })
            });
            return;
        }
        if (newStatus === "completed" && !canMarkTaskCompleted(task)) {
            toast.error(
                dict.tasks?.error_checklist_incomplete
                    || "Completa todos los elementos del checklist antes de marcar la tarea como hecha",
            );
            return;
        }

        setUpdatingTaskId(taskId);
        try {
            await TaskService.updateTaskItem(taskId, {
                status: newStatus,
                date_done: completionDateForStatus(newStatus),
            });
            toast.success(dict.tasks.success_update);
            onTaskUpdate();
            // If the modal is open for this task, update local state
            if (selectedTask && selectedTask.id === taskId) {
                setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
                setEditStatus(newStatus);
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        } finally {
            setUpdatingTaskId(null);
        }
    };

    // Drag & Drop handlers
    const handleDragStart = (e: React.DragEvent, taskId: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (!canMoveTaskOnKanban(currentUser, task)) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData("text/plain", taskId.toString());
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, status: KanbanStatus) => {
        if (!isAdminOrManager) return;
        e.preventDefault();
        if (dragOverColumn !== status) {
            setDragOverColumn(status);
        }
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, status: KanbanStatus) => {
        if (!isAdminOrManager) return;
        e.preventDefault();
        setDragOverColumn(null);
        const taskIdStr = e.dataTransfer.getData("text/plain");
        if (!taskIdStr) return;

        const taskId = parseInt(taskIdStr, 10);
        const task = tasks.find(t => t.id === taskId);

        if (canMoveTaskOnKanban(currentUser, task) && task?.status !== status) {
            await handleUpdateStatus(taskId, status);
        }
    };

    // Open task details modal
    const handleOpenDetail = (task: TaskItem) => {
        if (currentUser) acknowledgeTaskOpened(currentUser.id, task);
        const values = taskToEditValues(task);
        setSelectedTask(task);
        setEditTitle(values.title);
        setEditNotes(values.notes);
        setEditDescription(values.description);
        setEditPrice(values.price);
        setEditPricingMode(values.pricingMode);
        setEditQuantity(values.quantity);
        setEditUnit(values.unit);
        setEditLocationId(values.locationId);
        setEditUserId(values.userId);
        setEditStatus(values.status);
        setEditPriority(values.priority);
        setEditCreatedAt(values.planningDate);
        setEditPlanningTime(values.planningTime);
    };

    // Save modifications from the modal
    const handleSaveTaskDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdminOrManager) return;
        if (!selectedTask) return;
        if (selectedTask.is_invoiced) {
            toast.error("No se puede editar una tarea facturada");
            return;
        }

        const values: TaskEditValues = {
            title: editTitle,
            notes: editNotes,
            description: editDescription,
            price: editPrice,
            quantity: editQuantity,
            unit: editUnit,
            pricingMode: editPricingMode,
            locationId: editLocationId,
            userId: editUserId,
            status: editStatus,
            priority: editPriority,
            planningDate: editCreatedAt,
            planningTime: editPlanningTime,
        };
        if (isTaskPlanningDateChangeToPast(
            taskToEditValues(selectedTask).planningDate,
            values.planningDate,
        )) {
            toast.error("La fecha de planificación no puede ser anterior a hoy");
            return;
        }
        if (
            values.status === "completed"
            && !canMarkEditedTaskCompleted(selectedTask, values.description)
        ) {
            toast.error(
                dict.tasks?.error_checklist_incomplete
                    || "Completa todos los elementos del checklist antes de marcar la tarea como hecha",
            );
            return;
        }
        const violation = getScheduleViolation(
            selectedTask,
            buildScheduledStartAt(values),
        );
        if (violation) {
            const boundary = violation.boundary.toLocaleString("es-ES");
            toast.error(
                violation.type === "before_checkout"
                    ? `La planificación no puede ser anterior a la salida del huésped (${boundary})`
                    : dict.tasks?.errors?.planning_date_limit
                        || `La fecha de planificación no puede ser posterior a la fecha de entrada del huésped (${boundary})`
            );
            return;
        }

        try {
            setIsSavingTask(true);
            await TaskService.updateTaskItem(
                selectedTask.id,
                buildTaskUpdatePayload(
                    selectedTask,
                    currentUser?.company_id,
                    values,
                ),
            );

            toast.success(dict.tasks.success_update);
            onTaskUpdate();
            setSelectedTask(null);
        } catch (error: unknown) {
            console.error("Error saving task details", error);
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        } finally {
            setIsSavingTask(false);
        }
    };

    const handleDeleteTask = () => {
        if (!isAdminOrManager) return;
        if (!selectedTask) return;
        if (selectedTask.is_invoiced) {
            toast.error("No se puede eliminar una tarea facturada");
            return;
        }
        setTaskToDelete(selectedTask);
        setSelectedTask(null);
        setIsDeleteTaskDialogOpen(true);
    };

    const handleDeleteTaskConfirm = async () => {
        if (!isAdminOrManager) return;
        if (!taskToDelete) return;
        try {
            setIsDeletingTask(true);
            await TaskService.deleteTaskItem(taskToDelete.id);
            toast.success("Tarea eliminada con éxito.");
            setIsDeleteTaskDialogOpen(false);
            setTaskToDelete(null);
            setSelectedTask(null);
            onTaskUpdate();
        } catch (error: unknown) {
            console.error("Error deleting task", error);
            toast.error(getErrorMessage(error, "Error al eliminar la tarea."));
        } finally {
            setIsDeletingTask(false);
        }
    };

    const handleDuplicateTask = async (task: TaskItem) => {
        if (!canDuplicateTask(currentUser, task)) {
            toast.error(dict.tasks?.duplicate_invoiced_blocked || "No se puede duplicar una tarea facturada.");
            return;
        }
        try {
            setIsSavingTask(true);
            await TaskService.createTaskItem({
                title: `${task.title} (Copia)`,
                notes: task.notes || null,
                description: task.description || null,
                price: task.price,
                quantity: task.quantity,
                unit: task.unit || "unidad",
                pricing_mode: task.pricing_mode || "fixed",
                template_task_id: task.template_task_id,
                location_id: task.location_id,
                user_id: task.user_id,
                priority: task.priority || "medium",
            });
            toast.success("Tarea duplicada con éxito.");
            setSelectedTask(null);
            onTaskUpdate();
        } catch (error: unknown) {
            console.error("Error duplicating task", error);
            toast.error(getErrorMessage(error, "Error al duplicar la tarea."));
        } finally {
            setIsSavingTask(false);
        }
    };

    return {
        dict,
        searchQuery,
        setSearchQuery,
        selectedUserId,
        setSelectedUserId,
        selectedLocationId,
        setSelectedLocationId,
        updatingTaskId,
        dragOverColumn,
        selectedTask,
        setSelectedTask,
        isSavingTask,
        isDeletingTask,
        editTitle,
        setEditTitle,
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
        editUserId,
        setEditUserId,
        editStatus,
        setEditStatus,
        editPriority,
        setEditPriority,
        editCreatedAt,
        setEditCreatedAt,
        editPlanningTime,
        setEditPlanningTime,
        isAdminOrManager,
        filteredTasks,
        columnsTasks,
        getUserInitials,
        getUserFullName,
        getLocationName,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleOpenDetail,
        handleSaveTaskDetails,
        handleDeleteTask,
        handleDeleteTaskConfirm,
        handleDuplicateTask,
        isDeleteTaskDialogOpen,
        setIsDeleteTaskDialogOpen,
        taskToDelete,
    };
}
