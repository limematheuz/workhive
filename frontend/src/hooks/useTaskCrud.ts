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
import { getTaskDeletionErrorMessage } from "@/lib/task-deletion";
import { buildTaskDuplicatePayload } from "@/domain/tasks/task-duplicate";
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
import {
    hasValidTaskPricingAgreement,
    resolveTaskCreationPricing,
} from "@/lib/task-pricing";
import type { TaskCreationPricingOverride } from "@/lib/task-pricing";
import { loadTaskCreateLocationData } from "@/lib/load-task-create-location-data";
import { acknowledgeTaskOpened } from "@/components/dashboard/notifications/task-notification-acknowledgement";
import { useLocationZones } from "@/hooks/useLocationZones";

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
    selectedId: number | null;
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
    selectedId: null,
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
    const [taskPricingOverrides, setTaskPricingOverrides] = useState<Record<number, TaskCreationPricingOverride>>({});

    const [newLocationId, setNewLocationId] = useState<string>("");
    const [newUserId, setNewUserId] = useState<string>("");
    const [newCreatedAt, setNewCreatedAt] = useState<string>(() => getDefaultTaskDate());
    const [reservationState, setReservationState] = useState<ReservationState>(EMPTY_RESERVATIONS);
    const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
    const [selectedSpaceTaskTemplateIds, setSelectedSpaceTaskTemplateIds] = useState<number[]>([]);
    const { zones: locationZones, loading: loadingLocationZones } = useLocationZones(
        newLocationId ? Number(newLocationId) : null,
        isCreateOpen,
    );

    const houseTemplates = houseTemplateState.items;
    const selectedHouseTemplateId = houseTemplateState.selectedId;
    const loadingHouseTemplates = houseTemplateState.loading;
    const availableReservations = reservationState.items;
    const loadingReservations = reservationState.loading;
    const newCheckoutReservationId = reservationState.checkoutId;
    const newNextReservationId = reservationState.nextId;

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
    const [editPricingMode, setEditPricingMode] = useState<TaskPricingMode>("fixed");
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
        setHouseTemplateState({ items: [], selectedId: null, loading: true });
        setReservationState({ items: [], checkoutId: "", nextId: "", loading: true });
        setTaskPricingOverrides({});
        setSelectedZoneIds([]);
        setSelectedSpaceTaskTemplateIds([]);

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
                selectedId: data[0]?.template_task_id ?? null,
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
        setTaskPricingOverrides({});
        setSelectedZoneIds([]);
        setSelectedSpaceTaskTemplateIds([]);
        setIsCreateOpen(true);
    };

    const closeCreate = () => {
        setIsCreateOpen(false);
        setHouseTemplateState(EMPTY_HOUSE_TEMPLATES);
        setReservationState(EMPTY_RESERVATIONS);
        setTaskPricingOverrides({});
        setSelectedZoneIds([]);
        setSelectedSpaceTaskTemplateIds([]);
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
        
        if (!useHouseChecklist || selectedHouseTemplateId === null) {
            toast.error("Por favor, selecciona un servicio para el trabajo.");
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

            const templateId = selectedHouseTemplateId;
            const template = templates.find((item) => item.id === templateId);
            const locationTemplate = houseTemplates.find(
                (item) => item.template_task_id === templateId,
            );
            if (!template || !locationTemplate) {
                toast.error("El servicio seleccionado ya no está disponible. Vuelve a seleccionarlo.");
                return;
            }
            const defaults = getEffectiveLocationTemplate(locationTemplate, template);
            const pricing = resolveTaskCreationPricing(
                defaults,
                taskPricingOverrides[templateId],
            );
            const effective = {
                ...defaults,
                ...pricing,
            };
            if (!hasValidTaskPricingAgreement(effective.pricingMode, effective.price)) {
                toast.error(
                    `Define un precio ${effective.pricingMode === "hourly" ? "por hora positivo" : "fijo válido"} en la plantilla «${effective.name || "sin nombre"}» antes de crear el trabajo.`,
                );
                return;
            }

            await TaskService.createTaskItem({
                title: effective.name || "Limpieza fija",
                description: buildChecklistDescription({
                    description: effective.description,
                    templateTaskId: templateId,
                    users,
                    selectedUserId: newUserId,
                    fixedChecklistAssignments,
                }),
                price: effective.price,
                quantity: 1.0,
                unit: effective.pricingMode === "hourly" ? "hour" : effective.unit,
                pricing_mode: effective.pricingMode,
                template_task_id: templateId,
                location_id: parseInt(newLocationId, 10),
                user_id: taskAssigneeId,
                scheduled_start_at: checkoutReservation?.check_out_at
                    || buildTaskPlanningDate(newCreatedAt),
                due_at: nextReservation?.check_in_at || undefined,
                service_context: serviceContext,
                checkout_reservation_id: checkoutReservation?.id || null,
                next_reservation_id: nextReservation?.id || null,
                priority,
                zone_ids: selectedZoneIds,
                space_task_template_ids: selectedSpaceTaskTemplateIds,
            });
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
        const violation = getScheduleViolation(
            selectedTask,
            buildScheduledStartAt(values, selectedTask),
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
            toast.error(getTaskDeletionErrorMessage(error, dict.tasks.delete_confirm_dialog));
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
                selectedId: templateTaskId,
                loading: false,
            });
        } catch (error: unknown) {
            console.error("Error linking house template", error);
            toast.error(getErrorMessage(error, "Error al asociar la plantilla al local."));
        }
    };

    const selectHouseTemplate = (id: number) => {
        setHouseTemplateState((current) => ({ ...current, selectedId: id }));
        setTaskPricingOverrides((overrides) => (
            overrides[id] ? { [id]: overrides[id] } : {}
        ));
    };

    const handleDuplicateTask = async (task: TaskItem) => {
        if (!canDuplicateTask(currentUser, task)) {
            toast.error(dict.tasks?.duplicate_invoiced_blocked || "No se puede duplicar una tarea facturada.");
            return;
        }
        try {
            setIsSaving(true);
            await TaskService.createTaskItem(buildTaskDuplicatePayload(task));
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
        selectedHouseTemplateId,
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
        locationZones,
        loadingLocationZones,
        selectedZoneIds,
        setSelectedZoneIds,
        selectedSpaceTaskTemplateIds,
        setSelectedSpaceTaskTemplateIds,
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
        taskToDelete,
        isDeleteTaskDialogOpen,
        setIsDeleteTaskDialogOpen,
        handleToggleStatus,
        handleCreateTask,
        handleOpenDetail,
        handleSaveTaskDetails,
        handleDeleteTask,
        handleDeleteTaskConfirm,
        selectHouseTemplate,
        availableTemplates,
        handleLinkHouseTemplate,
        handleDuplicateTask,
        fixedChecklistAssignments,
        setFixedChecklistAssignments,
        taskPricingOverrides,
        setTaskPricingOverrides,
    };
}
