"use client";

import React, { startTransition, useState, useEffect, useEffectEvent } from "react";
import { TaskService, TaskItem } from "@/services/task.service";
import { toast } from "@/lib/toast";
import { ShieldAlert } from "lucide-react";
import type {
    LocationTemplateSummary as HouseTemplate,
    TemplateTask,
} from "@/types/template";
import { LocationTemplateService } from "@/services/template.service";
import { User } from "@/types/user";
import { Reservation } from "@/types/reservation";
import { ReservationService } from "@/services/reservation.service";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import {
    buildScheduledStartAt,
    buildTaskUpdatePayload,
    taskToEditValues,
    type TaskEditValues,
} from "@/domain/tasks/task-edit";
import {
    getScheduleViolation,
    isTaskPlanningDateBeforeToday,
} from "@/domain/tasks/task-schedule";
import { completionDateForStatus } from "@/domain/tasks/task-status";
import { canMarkTaskCompleted } from "@/lib/task-checklist-completion";
import type { TaskPriority, TaskStatus } from "@/types/task";
import { getEffectiveLocationTemplate } from "@/domain/locations/location-template";
import {
    ALL_WORKERS_VALUE,
    buildChecklistDescription,
    buildTaskPlanningDate,
    getDefaultTaskDate,
    getTaskAssigneeId,
    getTaskCreationSchedule,
} from "@/domain/tasks/task-create";
import { canDuplicateTask } from "@/domain/tasks/task-permissions";
import { loadTaskCreateLocationData } from "@/lib/load-task-create-location-data";
import { acknowledgeTaskOpened } from "@/components/dashboard/notifications/task-notification-acknowledgement";

interface UseTaskCrudParams {
    dict: Dictionary;
    templates: TemplateTask[];
    loadTasks: () => Promise<void>;
    setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
    users: User[];
    currentUser: User | null;
    canManageReservationsForLocation: (locationId: number) => boolean;
}

type HouseTemplateState = {
    items: HouseTemplate[];
    selectedIds: number[];
    loading: boolean;
};

type ReservationState = {
    items: Reservation[];
    checkoutId: string;
    nextId: string;
    loading: boolean;
};

const EMPTY_HOUSE_TEMPLATES: HouseTemplateState = {
    items: [],
    selectedIds: [],
    loading: false,
};

const EMPTY_RESERVATIONS: ReservationState = {
    items: [],
    checkoutId: "",
    nextId: "",
    loading: false,
};

export function useTaskCrud({
    dict,
    templates,
    loadTasks,
    setTasks,
    users,
    currentUser,
    canManageReservationsForLocation,
}: UseTaskCrudParams) {
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isDeletingTask, setIsDeletingTask] = useState<boolean>(false);
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

    const [houseTemplateState, setHouseTemplateState] = useState<HouseTemplateState>(EMPTY_HOUSE_TEMPLATES);
    const [useHouseChecklist, setUseHouseChecklist] = useState<boolean>(true);
    const [fixedChecklistAssignments, setFixedChecklistAssignments] = useState<Record<string, string>>({});

    const [newLocationId, setNewLocationId] = useState<string>("");
    const [newUserId, setNewUserId] = useState<string>("");
    const [newCreatedAt, setNewCreatedAt] = useState<string>(() => getDefaultTaskDate());
    const [reservationState, setReservationState] = useState<ReservationState>(EMPTY_RESERVATIONS);

    const houseTemplates = houseTemplateState.items;
    const selectedHouseTemplateIds = houseTemplateState.selectedIds;
    const loadingHouseTemplates = houseTemplateState.loading;
    const availableReservations = reservationState.items;
    const loadingReservations = reservationState.loading;
    const newCheckoutReservationId = reservationState.checkoutId;
    const newNextReservationId = reservationState.nextId;

    const setSelectedHouseTemplateIds = (value: React.SetStateAction<number[]>) => {
        setHouseTemplateState((prev) => ({
            ...prev,
            selectedIds: typeof value === "function" ? value(prev.selectedIds) : value,
        }));
    };

    const setNewCheckoutReservationId = (value: string) => {
        setReservationState((prev) => ({ ...prev, checkoutId: value }));
    };

    const setNewNextReservationId = (value: string) => {
        setReservationState((prev) => ({ ...prev, nextId: value }));
    };

    const [editTitle, setEditTitle] = useState<string>("");
    const [editNotes, setEditNotes] = useState<string>("");
    const [editDescription, setEditDescription] = useState<string>("");
    const [editPrice, setEditPrice] = useState<string>("");
    const [editQuantity, setEditQuantity] = useState<string>("");
    const [editUnit, setEditUnit] = useState<string>("");
    const [editLocationId, setEditLocationId] = useState<string>("");
    const [editUserId, setEditUserId] = useState<string>("");
    const [editStatus, setEditStatus] = useState<TaskStatus>("pending");
    const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
    const [editCreatedAt, setEditCreatedAt] = useState<string>("");
    const [editPlanningTime, setEditPlanningTime] = useState<string>("12:00");

    const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
    const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState<boolean>(false);

    const syncCreateLocationData = useEffectEvent(async (locationId: string) => {
        setHouseTemplateState({ items: [], selectedIds: [], loading: true });
        setReservationState({ items: [], checkoutId: "", nextId: "", loading: true });

        const canLinkReservations = canManageReservationsForLocation(Number(locationId));
        const result = await loadTaskCreateLocationData(Number(locationId), {
            getLocationTemplates: LocationTemplateService.getTemplates,
            getReservations: canLinkReservations
                ? (selectedLocationId) => ReservationService.getReservations({
                    locationId: selectedLocationId,
                })
                : async () => [],
        });

        if (!result.locationTemplatesError) {
            const data = result.locationTemplates;
            setHouseTemplateState({
                items: data,
                selectedIds: data.map((ht) => ht.template_task_id),
                loading: false,
            });
        } else {
            setHouseTemplateState(EMPTY_HOUSE_TEMPLATES);
            toast.error(
                getErrorMessage(
                    result.locationTemplatesError,
                    "No se pudieron cargar las plantillas del local.",
                ),
            );
        }

        if (!result.reservationsError) {
            setReservationState({
                items: result.reservations.filter(
                    (reservation) => reservation.status !== "cancelled",
                ),
                checkoutId: "",
                nextId: "",
                loading: false,
            });
        } else {
            setReservationState(EMPTY_RESERVATIONS);
            toast.error(
                getErrorMessage(
                    result.reservationsError,
                    "No se pudieron cargar las reservas del local.",
                ),
            );
        }
    });

    useEffect(() => {
        if (!newLocationId || !isCreateOpen) return;
        startTransition(() => {
            void syncCreateLocationData(newLocationId);
        });
    }, [newLocationId, isCreateOpen]);

    const openCreate = () => {
        setHouseTemplateState(EMPTY_HOUSE_TEMPLATES);
        setReservationState(EMPTY_RESERVATIONS);
        setIsCreateOpen(true);
    };

    const closeCreate = () => {
        setIsCreateOpen(false);
        setHouseTemplateState(EMPTY_HOUSE_TEMPLATES);
        setReservationState(EMPTY_RESERVATIONS);
    };

    const handleToggleStatus = async (task: TaskItem, e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (task.is_invoiced) {
            toast.error("No se puede modificar una tarea que ya está facturada", {
                icon: React.createElement(ShieldAlert, { className: "w-5 h-5 text-red-500" })
            });
            return;
        }

        const newStatus = task.status === "completed" ? "pending" : "completed";
        if (newStatus === "completed" && !canMarkTaskCompleted(task)) {
            toast.error(
                dict.tasks?.error_checklist_incomplete
                    || "Completa todos los elementos del checklist antes de marcar la tarea como hecha",
            );
            return;
        }
        try {
            setTasks(prev =>
                prev.map(t => (t.id === task.id ? { ...t, status: newStatus } : t))
            );

            await TaskService.updateTaskItem(task.id, {
                status: newStatus,
                date_done: completionDateForStatus(newStatus),
            });
            toast.success(dict.tasks.success_update);
            loadTasks();
        } catch (error: unknown) {
            setTasks(prev =>
                prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t))
            );
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const hasChecklistItems = houseTemplates.length > 0 && useHouseChecklist && selectedHouseTemplateIds.length > 0;
        
        if (!hasChecklistItems) {
            toast.error("Por favor, selecciona elementos del checklist para el local.");
            return;
        }

        if (!newLocationId) {
            toast.error("Por favor selecciona una ubicación");
            return;
        }

        if (isTaskPlanningDateBeforeToday(newCreatedAt)) {
            toast.error("La fecha de planificación no puede ser anterior a hoy");
            return;
        }

        try {
            setIsSaving(true);
            const promises: Promise<TaskItem>[] = [];
            const checkoutReservation = availableReservations.find(
                reservation => reservation.id.toString() === newCheckoutReservationId
            );
            const nextReservation = availableReservations.find(
                reservation => reservation.id.toString() === newNextReservationId
            );
            if (
                checkoutReservation
                && nextReservation
                && checkoutReservation.id === nextReservation.id
            ) {
                toast.error("La reserva que sale y la próxima entrada deben ser diferentes.");
                return;
            }
            const { serviceContext, priority } = getTaskCreationSchedule(
                checkoutReservation,
                nextReservation,
            );
            const taskAssigneeId = getTaskAssigneeId(newUserId);

            selectedHouseTemplateIds.forEach(tmplId => {
                const tmpl = templates.find(t => t.id === tmplId);
                const houseTmpl = houseTemplates.find(ht => ht.template_task_id === tmplId);
                const effective = getEffectiveLocationTemplate(houseTmpl || {}, tmpl);
                const price = effective.price ?? 0;

                promises.push(
                    TaskService.createTaskItem({
                        title: effective.name || "Limpieza fija",
                        description: buildChecklistDescription({
                            description: effective.description,
                            templateTaskId: tmplId,
                            users,
                            selectedUserId: newUserId,
                            fixedChecklistAssignments,
                        }),
                        price: price,
                        quantity: 1.0,
                        unit: effective.unit,
                        template_task_id: tmplId,
                        location_id: parseInt(newLocationId, 10),
                        user_id: taskAssigneeId,
                        scheduled_start_at: checkoutReservation?.check_out_at
                            || buildTaskPlanningDate(newCreatedAt),
                        due_at: nextReservation?.check_in_at || undefined,
                        service_context: serviceContext,
                        checkout_reservation_id: checkoutReservation?.id || null,
                        next_reservation_id: nextReservation?.id || null,
                        priority,
                    })
                );
            });

            await Promise.all(promises);
            toast.success(newUserId === ALL_WORKERS_VALUE
                ? "Trabajos registrados para todos los trabajadores."
                : "Trabajos registrados exitosamente."
            );
            
            setFixedChecklistAssignments({});
            setNewCreatedAt(getDefaultTaskDate());
            closeCreate();
            
            loadTasks();
        } catch (error: unknown) {
            console.error("Error creating tasks", error);
            toast.error(getErrorMessage(error, "Error al registrar las tareas."));
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenDetail = (task: TaskItem) => {
        if (currentUser) acknowledgeTaskOpened(currentUser.id, task);
        const values = taskToEditValues(task);
        setSelectedTask(task);
        setEditTitle(values.title);
        setEditNotes(values.notes);
        setEditDescription(values.description);
        setEditPrice(values.price);
        setEditQuantity(values.quantity);
        setEditUnit(values.unit);
        setEditLocationId(values.locationId);
        setEditUserId(values.userId);
        setEditStatus(values.status);
        setEditPriority(values.priority);
        setEditCreatedAt(values.planningDate);
        setEditPlanningTime(values.planningTime);
    };

    const handleSaveTaskDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask) return;
        if (selectedTask.is_invoiced) {
            toast.error("No se puede modificar una tarea ya facturada");
            return;
        }

        const values: TaskEditValues = {
            title: editTitle,
            notes: editNotes,
            description: editDescription,
            price: editPrice,
            quantity: editQuantity,
            unit: editUnit,
            locationId: editLocationId,
            userId: editUserId,
            status: editStatus,
            priority: editPriority,
            planningDate: editCreatedAt,
            planningTime: editPlanningTime,
        };
        if (isTaskPlanningDateBeforeToday(values.planningDate)) {
            toast.error("La fecha de planificación no puede ser anterior a hoy");
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
            setIsSaving(true);
            await TaskService.updateTaskItem(
                selectedTask.id,
                buildTaskUpdatePayload(
                    selectedTask,
                    currentUser?.company_id,
                    values,
                ),
            );

            toast.success(dict.tasks.success_update);
            setSelectedTask(null);
            loadTasks();
        } catch (error: unknown) {
            console.error("Error updating task details", error);
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTask = (task: TaskItem) => {
        if (task.is_invoiced) {
            toast.error("No se puede eliminar una tarea ya facturada");
            return;
        }
        setTaskToDelete(task);
        setSelectedTask(null);
        setIsDeleteTaskDialogOpen(true);
    };

    const handleDeleteTaskConfirm = async () => {
        if (!taskToDelete) return;
        try {
            setIsDeletingTask(true);
            await TaskService.deleteTaskItem(taskToDelete.id);
            toast.success("Tarea eliminada con éxito.");
            setIsDeleteTaskDialogOpen(false);
            setTaskToDelete(null);
            setSelectedTask(null);
            loadTasks();
        } catch (error: unknown) {
            console.error("Error deleting task", error);
            toast.error(getErrorMessage(error, "Error al eliminar la tarea."));
        } finally {
            setIsDeletingTask(false);
        }
    };

    const availableTemplates = templates.filter(gt =>
        !houseTemplates.some(ht => ht.template_task_id === gt.id)
    );

    const handleLinkHouseTemplate = async (templateTaskId: number, customPrice: number | null) => {
        if (!newLocationId) return;
        try {
            await LocationTemplateService.assignTemplate(
                Number(newLocationId),
                templateTaskId,
                customPrice
            );
            toast.success("Tarea fija asociada al local correctamente.");
            const data = await LocationTemplateService.getTemplates(Number(newLocationId));
            setHouseTemplateState({
                items: data,
                selectedIds: [...new Set([...data.map((ht) => ht.template_task_id), templateTaskId])],
                loading: false,
            });
        } catch (error: unknown) {
            console.error("Error linking house template", error);
            toast.error(getErrorMessage(error, "Error al asociar la plantilla al local."));
        }
    };

    const toggleHouseTemplateSelection = (id: number) => {
        setSelectedHouseTemplateIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDuplicateTask = async (task: TaskItem) => {
        if (!canDuplicateTask(currentUser, task)) {
            toast.error(dict.tasks?.duplicate_invoiced_blocked || "No se puede duplicar una tarea facturada.");
            return;
        }
        try {
            setIsSaving(true);
            await TaskService.createTaskItem({
                title: `${task.title} (Copia)`,
                notes: task.notes || null,
                description: task.description || null,
                price: task.price,
                quantity: task.quantity,
                unit: task.unit || "unidad",
                template_task_id: task.template_task_id,
                location_id: task.location_id,
                user_id: task.user_id,
                priority: task.priority || "medium",
            });
            toast.success("Tarea duplicada con éxito.");
            setSelectedTask(null);
            loadTasks();
        } catch (error: unknown) {
            console.error("Error duplicating task", error);
            toast.error(getErrorMessage(error, "Error al duplicar la tarea."));
        } finally {
            setIsSaving(false);
        }
    };

    return {
        isSaving,
        isDeletingTask,
        isCreateOpen,
        setIsCreateOpen: (open: boolean) => {
            if (open) openCreate();
            else closeCreate();
        },
        selectedTask,
        setSelectedTask,
        houseTemplates,
        loadingHouseTemplates,
        selectedHouseTemplateIds,
        useHouseChecklist,
        setUseHouseChecklist,
        newLocationId,
        setNewLocationId,
        newUserId,
        setNewUserId,
        newCreatedAt,
        setNewCreatedAt,
        availableReservations,
        loadingReservations,
        newCheckoutReservationId,
        setNewCheckoutReservationId,
        newNextReservationId,
        setNewNextReservationId,
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
        setEditUserId,
        editStatus,
        setEditStatus,
        editPriority,
        setEditPriority,
        editCreatedAt,
        setEditCreatedAt,
        editPlanningTime,
        setEditPlanningTime,
        taskToDelete,
        isDeleteTaskDialogOpen,
        setIsDeleteTaskDialogOpen,
        handleToggleStatus,
        handleCreateTask,
        handleOpenDetail,
        handleSaveTaskDetails,
        handleDeleteTask,
        handleDeleteTaskConfirm,
        toggleHouseTemplateSelection,
        availableTemplates,
        handleLinkHouseTemplate,
        handleDuplicateTask,
        fixedChecklistAssignments,
        setFixedChecklistAssignments,
    };
}
