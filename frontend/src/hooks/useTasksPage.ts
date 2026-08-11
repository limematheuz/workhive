"use client";

import { startTransition, useState, useEffect, useEffectEvent, useRef } from "react";
import {
    TaskService,
    TaskItem,
    type TaskItemFilters,
} from "@/services/task.service";
import { LocationService, Location } from "@/services/location.service";
import { UserService } from "@/services/user.service";
import { User } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { useTaskFilters } from "./useTaskFilters";
import { useTaskCrud } from "./useTaskCrud";
import { useTemplateCrud } from "./useTemplateCrud";
import { TemplateTaskService } from "@/services/template.service";
import type { TemplateTask } from "@/types/template";

import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import {
    canManageCompanyTasks,
    isSuperadmin,
} from "@/domain/access/roles";
import { buildTaskListFilters } from "@/domain/tasks/task-list";
import { isTaskPlanningDateBeforeToday } from "@/domain/tasks/task-schedule";
import type { TaskAcceptanceInput } from "@/domain/tasks/task-acceptance";
import { canLinkTaskReservations } from "@/features/reservations/reservation-helpers";

export type {
    LocationTemplateSummary as HouseTemplate,
    TemplateTask,
} from "@/types/template";

export function useTasksPage() {
    const { dict } = useDictionary();
    const { user: currentUser, loading: userLoading } = useUser();
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<TemplateTask[]>([]);
    const [catalogStatus, setCatalogStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
    const bootstrappedRef = useRef(false);

    const {
        selectedStatus,
        setSelectedStatus,
        selectedLocationId,
        setSelectedLocationId,
        selectedUserId,
        setSelectedUserId,
        activeTab,
        setActiveTab,
    } = useTaskFilters();

    const isAdminOrManager = canManageCompanyTasks(currentUser);
    const loadingData = userLoading || catalogStatus === "idle" || catalogStatus === "loading";

    const loadTasks = async (
        silent = false,
        overrides?: {
            currentUser?: User | null;
            activeTab?: typeof activeTab;
            selectedUserId?: string;
        },
    ) => {
        const effectiveUser = overrides?.currentUser ?? currentUser;
        if (!bootstrappedRef.current || !effectiveUser) return;

        try {
            if (!silent) setLoadingTasks(true);
            const filters: TaskItemFilters = buildTaskListFilters({
                currentUser: effectiveUser,
                activeTab: overrides?.activeTab ?? activeTab,
                selectedLocationId,
                selectedStatus,
                selectedUserId: overrides?.selectedUserId ?? selectedUserId,
            });

            const data = await TaskService.getAllTaskItems(filters);
            setTasks(data);
        } catch (error) {
            console.error("Error loading tasks list", error);
            if (!silent) toast.error(dict.tasks.error_update);
        } finally {
            setLoadingTasks(false);
        }
    };

    const loadCatalogEvent = useEffectEvent(async () => {
        if (!currentUser) return;

        setCatalogStatus("loading");
        try {
            const canManageTasks = canManageCompanyTasks(currentUser);

            const [locs, usrs, tmpls] = await Promise.all([
                LocationService.getLocations(),
                canManageTasks
                    ? UserService.getUsers().catch(() => [currentUser] as User[])
                    : Promise.resolve([currentUser] as User[]),
                canManageTasks
                    ? TemplateTaskService.getTemplates().catch(() => [] as TemplateTask[])
                    : Promise.resolve([] as TemplateTask[])
            ]);

            const filteredUsers = isSuperadmin(currentUser)
                ? usrs
                : usrs.filter(u => u.role?.name !== "superadmin");

            setLocations(locs);
            setUsers(filteredUsers);
            setTemplates(tmpls);

            const nextUserId = !canManageTasks ? currentUser.id.toString() : selectedUserId;
            const nextTab = !canManageTasks ? "kanban" as const : activeTab;
            if (!canManageTasks) {
                setSelectedUserId(nextUserId);
                setActiveTab(nextTab);
            }

            bootstrappedRef.current = true;
            setCatalogStatus("ready");
            await loadTasks(false, {
                currentUser,
                activeTab: nextTab,
                selectedUserId: nextUserId,
            });
        } catch (error) {
            console.error("Error loading initial tasks page data", error);
            toast.error(dict.tasks.error_update);
            setCatalogStatus("error");
        }
    });

    useEffect(() => {
        if (userLoading || !currentUser) return;
        if (catalogStatus !== "idle") return;
        startTransition(() => {
            void loadCatalogEvent();
        });
    }, [userLoading, currentUser, catalogStatus]);

    const loadTasksEvent = useEffectEvent(() => {
        void loadTasks();
    });

    useEffect(() => {
        if (!bootstrappedRef.current || !currentUser) return;
        loadTasksEvent();
    }, [selectedStatus, selectedLocationId, selectedUserId, activeTab, currentUser]);

    useBackgroundPolling(() => loadTasks(true), POLL_INTERVALS.tasks);

    const canManageReservationsForLocation = (locationId: number) => {
        const location = locations.find((item) => item.id === locationId);
        return Boolean(location && canLinkTaskReservations(location));
    };

    const crud = useTaskCrud({
        dict,
        templates,
        loadTasks,
        setTasks,
        users,
        currentUser,
        canManageReservationsForLocation,
    });
    const {
        newLocationId,
        setNewLocationId,
    } = crud;

    const applyCreateFormDefaults = () => {
        const ownLocations = currentUser?.company_id
            ? locations.filter(location => (
                location.owner_company_id === currentUser.company_id
                || location.managing_company_id === currentUser.company_id
                || (!location.owner_company_id && !location.managing_company_id)
            ))
            : locations;
        if (ownLocations.length > 0 && !newLocationId) {
            setNewLocationId(ownLocations[0].id.toString());
        }
    };

    const openCreateTask = (open: boolean = true) => {
        if (!open) {
            crud.setIsCreateOpen(false);
            return;
        }
        applyCreateFormDefaults();
        crud.setIsCreateOpen(true);
    };

    const templateCrud = useTemplateCrud({
        dict,
        setTemplates,
    });

    const getAssigneeName = (userId: number | null) => {
        if (userId === null) return "Sin asignar";
        const u = users.find(usr => usr.id === userId);
        if (u) {
            return u.full_name || u.email;
        }
        if (currentUser && currentUser.id === userId) {
            return currentUser.full_name || currentUser.email;
        }
        return `ID: ${userId}`;
    };

    const getLocationName = (locId: number) => {
        const l = locations.find(loc => loc.id === locId);
        return l ? l.name : `Location ID: ${locId}`;
    };

    const activeTasks = tasks.filter(t => t.status !== "requested" && t.status !== "rejected");
    const requestedTasks = tasks.filter(t => t.status === "requested");

    const handleAcceptTask = async (taskId: number, input: TaskAcceptanceInput) => {
        if (input.scheduledStartAt && isTaskPlanningDateBeforeToday(input.scheduledStartAt)) {
            toast.error("La fecha de planificación no puede ser anterior a hoy");
            return;
        }
        try {
            await TaskService.acceptTaskItem(taskId, input);
            toast.success("Solicitud aceptada con éxito");
            await loadTasks();
        } catch (error) {
            console.error("Error accepting task:", error);
            toast.error("No se pudo aceptar la solicitud");
        }
    };

    const handleRejectTask = async (taskId: number) => {
        try {
            await TaskService.rejectTaskItem(taskId);
            toast.success("Solicitud rechazada");
            await loadTasks();
        } catch (error) {
            console.error("Error rejecting task:", error);
            toast.error("No se pudo rechazar la solicitud");
        }
    };

    return {
        dict,
        tasks: activeTasks,
        requestedTasks,
        handleAcceptTask,
        handleRejectTask,
        locations,
        users,
        templates,
        currentUser,
        activeTab,
        setActiveTab,
        loadingData,
        loadingTasks,
        selectedStatus,
        setSelectedStatus,
        selectedLocationId,
        setSelectedLocationId,
        selectedUserId,
        setSelectedUserId,
        isAdminOrManager,
        adminOrManager: isAdminOrManager,
        loadTasks,
        getAssigneeName,
        getLocationName,

        // Tasks CRUD
        isSaving: crud.isSaving,
        saving: crud.isSaving,
        isCreateOpen: crud.isCreateOpen,
        createOpen: crud.isCreateOpen,
        setIsCreateOpen: openCreateTask,
        setCreateOpen: openCreateTask,
        selectedTask: crud.selectedTask,
        setSelectedTask: crud.setSelectedTask,
        houseTemplates: crud.houseTemplates,
        loadingHouseTemplates: crud.loadingHouseTemplates,
        selectedHouseTemplateId: crud.selectedHouseTemplateId,
        useHouseChecklist: crud.useHouseChecklist,
        setUseHouseChecklist: crud.setUseHouseChecklist,
        newLocationId: crud.newLocationId,
        setNewLocationId: crud.setNewLocationId,
        newUserId: crud.newUserId,
        setNewUserId: crud.setNewUserId,
        newCreatedAt: crud.newCreatedAt,
        setNewCreatedAt: crud.setNewCreatedAt,
        availableReservations: crud.availableReservations,
        loadingReservations: crud.loadingReservations,
        newCheckoutReservationId: crud.newCheckoutReservationId,
        setNewCheckoutReservationId: crud.setNewCheckoutReservationId,
        newNextReservationId: crud.newNextReservationId,
        setNewNextReservationId: crud.setNewNextReservationId,
        editTitle: crud.editTitle,
        setEditTitle: crud.setEditTitle,
        editNotes: crud.editNotes,
        setEditNotes: crud.setEditNotes,
        editDescription: crud.editDescription,
        setEditDescription: crud.setEditDescription,
        editPrice: crud.editPrice,
        setEditPrice: crud.setEditPrice,
        editPricingMode: crud.editPricingMode,
        setEditPricingMode: crud.setEditPricingMode,
        editQuantity: crud.editQuantity,
        setEditQuantity: crud.setEditQuantity,
        editUnit: crud.editUnit,
        setEditUnit: crud.setEditUnit,
        editLocationId: crud.editLocationId,
        setEditLocationId: crud.setEditLocationId,
        editUserId: crud.editUserId,
        setEditUserId: crud.setEditUserId,
        editStatus: crud.editStatus,
        setEditStatus: crud.setEditStatus,
        editPriority: crud.editPriority,
        setEditPriority: crud.setEditPriority,
        editCreatedAt: crud.editCreatedAt,
        setEditCreatedAt: crud.setEditCreatedAt,
        editPlanningTime: crud.editPlanningTime,
        setEditPlanningTime: crud.setEditPlanningTime,
        taskToDelete: crud.taskToDelete,
        isDeleteTaskDialogOpen: crud.isDeleteTaskDialogOpen,
        setIsDeleteTaskDialogOpen: crud.setIsDeleteTaskDialogOpen,
        isDeletingTask: crud.isDeletingTask,
        deletingTask: crud.isDeletingTask,
        handleToggleStatus: crud.handleToggleStatus,
        handleCreateTask: crud.handleCreateTask,
        handleOpenDetail: crud.handleOpenDetail,
        handleSaveTaskDetails: crud.handleSaveTaskDetails,
        handleDeleteTask: crud.handleDeleteTask,
        handleDeleteTaskConfirm: crud.handleDeleteTaskConfirm,
        selectHouseTemplate: crud.selectHouseTemplate,
        availableTemplates: crud.availableTemplates,
        handleLinkHouseTemplate: crud.handleLinkHouseTemplate,
        handleDuplicateTask: crud.handleDuplicateTask,
        fixedChecklistAssignments: crud.fixedChecklistAssignments,
        setFixedChecklistAssignments: crud.setFixedChecklistAssignments,
        taskPricingOverrides: crud.taskPricingOverrides,
        setTaskPricingOverrides: crud.setTaskPricingOverrides,

        // Templates CRUD
        isTemplateModalOpen: templateCrud.isTemplateModalOpen,
        templateModalOpen: templateCrud.isTemplateModalOpen,
        setIsTemplateModalOpen: templateCrud.setIsTemplateModalOpen,
        setTemplateModalOpen: templateCrud.setIsTemplateModalOpen,
        selectedTemplate: templateCrud.selectedTemplate,
        tmplName: templateCrud.tmplName,
        setTmplName: templateCrud.setTmplName,
        tmplDescription: templateCrud.tmplDescription,
        setTmplDescription: templateCrud.setTmplDescription,
        tmplPrice: templateCrud.tmplPrice,
        setTmplPrice: templateCrud.setTmplPrice,
        tmplUnit: templateCrud.tmplUnit,
        setTmplUnit: templateCrud.setTmplUnit,
        tmplPricingMode: templateCrud.tmplPricingMode,
        setTmplPricingMode: templateCrud.setTmplPricingMode,
        isDeletingTemplate: templateCrud.isDeletingTemplate,
        handleSaveTemplate: templateCrud.handleSaveTemplate,
        handleOpenTemplateModal: templateCrud.handleOpenTemplateModal,
        handleDeleteTemplate: templateCrud.handleDeleteTemplate,
        handleDuplicateTemplate: templateCrud.handleDuplicateTemplate,
    };
}
