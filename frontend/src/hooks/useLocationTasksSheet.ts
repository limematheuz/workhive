"use client";

import { startTransition, useState, useEffect, useEffectEvent, type SetStateAction } from "react";
import { TaskService, TaskItem } from "@/services/task.service";
import { UserService } from "@/services/user.service";
import { authService } from "@/services/auth.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import {
    LocationTemplateService,
    TemplateTaskService,
} from "@/services/template.service";
import type {
    LocationTemplate as HouseTemplate,
    TemplateTask,
} from "@/types/template";
import { getErrorMessage } from "@/lib/errors";
import { loadLocationTemplatesBundle } from "@/lib/load-location-templates-bundle";
import {
    canManageCompanyTasks,
    isSuperadmin,
} from "@/domain/access/roles";
import { canMarkTaskCompleted } from "@/lib/task-checklist-completion";

interface UseLocationTasksSheetParams {
    location: Location | null;
    open: boolean;
    initialCreateForm?: boolean;
    initialTab?: "history" | "templates";
}

export function useLocationTasksSheet({ location, open, initialCreateForm, initialTab = "history" }: UseLocationTasksSheetParams) {
    const { dict } = useDictionary();
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [globalTemplates, setGlobalTemplates] = useState<TemplateTask[]>([]);

    // Executed data states
    const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // House template states
    const [houseTemplates, setHouseTemplates] = useState<HouseTemplate[]>([]);
    const [loadingHouseTemplates, setLoadingHouseTemplates] = useState<boolean>(false);
    const [selectedGlobalTemplateIds, setSelectedGlobalTemplateIds] = useState<number[]>([]);
    const [templatePrices, setTemplatePrices] = useState<Record<number, string>>({});
    const [isLinking, setIsLinking] = useState<boolean>(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [editingTemplateValues, setEditingTemplateValues] = useState({
        name: "",
        description: "",
        unit: "",
        price: "",
    });

    // Executed task creation form
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [price, setPrice] = useState<string>("");
    const [quantity, setQuantity] = useState<string>("");
    const [unit, setUnit] = useState<string>("hour");

    const sheetUiContextKey = open
        ? `${initialTab}|${initialCreateForm ? "create" : "list"}`
        : "closed";
    const buildSheetUiState = () => ({
        contextKey: sheetUiContextKey,
        activeTab: initialTab,
        showCreateForm: Boolean(open && initialCreateForm),
        assignedUserId: "",
    });
    const [sheetUiState, setSheetUiState] = useState(buildSheetUiState);
    const activeSheetUiState = sheetUiState.contextKey === sheetUiContextKey
        ? sheetUiState
        : buildSheetUiState();
    const activeTab = activeSheetUiState.activeTab;
    const showCreateForm = activeSheetUiState.showCreateForm;
    const assignedUserId = activeSheetUiState.assignedUserId;
    const setActiveTab = (nextTab: SetStateAction<"history" | "templates">) => {
        setSheetUiState((prev) => {
            const current = prev.contextKey === sheetUiContextKey ? prev : buildSheetUiState();
            const resolvedTab = typeof nextTab === "function" ? nextTab(current.activeTab) : nextTab;
            return { ...current, activeTab: resolvedTab };
        });
    };
    const setShowCreateForm = (nextValue: SetStateAction<boolean>) => {
        setSheetUiState((prev) => {
            const current = prev.contextKey === sheetUiContextKey ? prev : buildSheetUiState();
            const resolvedValue = typeof nextValue === "function" ? nextValue(current.showCreateForm) : nextValue;
            return { ...current, showCreateForm: resolvedValue };
        });
    };
    const setAssignedUserId = (nextValue: SetStateAction<string>) => {
        setSheetUiState((prev) => {
            const current = prev.contextKey === sheetUiContextKey ? prev : buildSheetUiState();
            const resolvedValue = typeof nextValue === "function" ? nextValue(current.assignedUserId) : nextValue;
            return { ...current, assignedUserId: resolvedValue };
        });
    };

    const isAdminOrManager = canManageCompanyTasks(currentUser);
    const locationOwnerCompanyId = location?.owner_company_id ?? location?.managing_company_id;
    const canManageLocationTemplates = Boolean(
        currentUser
        && (
            isSuperadmin(currentUser)
            || (locationOwnerCompanyId != null && locationOwnerCompanyId === currentUser.company_id)
        )
    );

    const loadCurrentUser = useEffectEvent(async () => {
        try {
            const user = await authService.getMe();
            setCurrentUser(user);
        } catch (error) {
            console.error("Error loading user profile", error);
        }
    });

    // Sync profile when the sheet opens (dialog visibility, not a DOM event).
    useEffect(() => {
        if (!open) return;
        startTransition(() => {
            void loadCurrentUser();
        });
    }, [open]);

    // Load tasks and job history
    const loadExecutedTasks = async () => {
        if (!location) return;
        try {
            setLoadingTasks(true);
            const data = await TaskService.getTaskItems({ locationId: location.id });
            setTasks(data);
        } catch (error) {
            console.error("Error fetching tasks", error);
            toast.error(dict.tasks.error_update);
        } finally {
            setLoadingTasks(false);
        }
    };

    // Load house and global templates (soft-fail so a 500 does not break the sheet)
    const loadHouseTemplates = async () => {
        if (!location) return;
        try {
            setLoadingHouseTemplates(true);
            const bundle = await loadLocationTemplatesBundle(location.id, {
                getHouseTemplates: LocationTemplateService.getTemplates,
                getGlobalTemplates: TemplateTaskService.getTemplates,
            });
            setHouseTemplates(bundle.houseTemplates);
            setGlobalTemplates(bundle.globalTemplates);
            if (bundle.houseTemplatesError || bundle.globalTemplatesError) {
                toast.error(
                    bundle.houseTemplatesError ||
                        bundle.globalTemplatesError ||
                        dict.tasks.error_update,
                );
            }
        } catch (error) {
            console.error("Error loading location templates", error);
            setHouseTemplates([]);
            setGlobalTemplates([]);
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        } finally {
            setLoadingHouseTemplates(false);
        }
    };

    const syncExecutedTasks = useEffectEvent(async () => {
        await loadExecutedTasks();
    });

    useEffect(() => {
        if (!open || !location) return;
        startTransition(() => {
            void syncExecutedTasks();
        });
    }, [open, location]);

    const syncAdminSheetData = useEffectEvent(async () => {
        try {
            if (isAdminOrManager) {
                const data = await UserService.getUsers();
                const filtered = data.filter(
                    (user) => user.role?.name === "viewer" && user.is_active !== false
                );
                setUsers(filtered);
            }
        } catch (error) {
            console.error("Error fetching users", error);
        }
        await loadHouseTemplates();
    });

    useEffect(() => {
        if (!open || !location || !currentUser) return;
        startTransition(() => {
            void syncAdminSheetData();
        });
    }, [open, location, currentUser, isAdminOrManager]);

    // Toggle completed
    const handleToggleStatus = async (task: TaskItem) => {
        if (task.is_invoiced) {
            toast.error("Cannot modify an already invoiced task");
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
                date_done: newStatus === "completed" ? new Date().toISOString() : null
            });
            toast.success(dict.tasks.success_update);
        } catch (error: unknown) {
            setTasks(prev =>
                prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t))
            );
            toast.error(getErrorMessage(error, dict.tasks.error_update));
        }
    };

    // Create manual/executed task
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location || !title) return;
        if (!assignedUserId) {
            toast.error("Please select who will perform this extra work.");
            return;
        }

        try {
            setSubmitting(true);
            const newTask = await TaskService.createTaskItem({
                title,
                description: description || null,
                location_id: location.id,
                user_id: parseInt(assignedUserId, 10),
                unit,
                price: (price !== "" && price !== null && price !== undefined) ? parseFloat(price) : null,
                quantity: (quantity !== "" && quantity !== null && quantity !== undefined) ? parseFloat(quantity) : null,
                priority: "medium",
            });

            setTasks(prev => [newTask, ...prev]);
            setTitle("");
            setDescription("");
            setPrice("");
            setQuantity("");
            setAssignedUserId("");
            setShowCreateForm(false);
            toast.success(dict.tasks.success_create);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.tasks.error_create));
        } finally {
            setSubmitting(false);
        }
    };

    // Associate a template as fixed task
    const handleLinkTemplates = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location || selectedGlobalTemplateIds.length === 0) return;

        try {
            setIsLinking(true);
            await Promise.all(selectedGlobalTemplateIds.map(templateId => (
                LocationTemplateService.assignTemplate(
                    location.id,
                    templateId,
                    templatePrices[templateId]?.trim()
                        ? parseFloat(templatePrices[templateId])
                        : null,
                )
            )));
            toast.success(dict.locations.sheet.toast_linked_success);
            setSelectedGlobalTemplateIds([]);
            setTemplatePrices({});
            await loadHouseTemplates();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.locations.sheet.toast_link_generic_error));
        } finally {
            setIsLinking(false);
        }
    };

    // Dissociate a fixed task template
    const handleUnlinkTemplate = async (templateId: number) => {
        if (!location) return;

        try {
            await LocationTemplateService.removeTemplate(location.id, templateId);

            toast.success(dict.locations.sheet.toast_unlinked_success);
            await loadHouseTemplates();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.locations.sheet.toast_unlink_generic_error));
        }
    };

    const handleUpdateTemplate = async (templateId: number) => {
        if (!location) return;

        try {
            await LocationTemplateService.updateOverrides(
                location.id,
                templateId,
                {
                    custom_name: editingTemplateValues.name.trim() || null,
                    custom_description: editingTemplateValues.description.trim() || null,
                    custom_unit: editingTemplateValues.unit.trim() || null,
                    custom_price: editingTemplateValues.price.trim()
                        ? parseFloat(editingTemplateValues.price)
                        : null,
                },
            );

            toast.success(dict.locations.sheet.toast_updated_success);
            setEditingTemplateId(null);
            await loadHouseTemplates();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.locations.sheet.toast_update_error));
        }
    };

    const getAssigneeName = (userId: number | null) => {
        if (userId === null) {
            return "Unassigned";
        }
        const u = users.find(usr => usr.id === userId);
        if (u) {
            return u.full_name || u.email;
        }
        if (currentUser && currentUser.id === userId) {
            return currentUser.full_name || currentUser.email;
        }
        return `ID: ${userId}`;
    };

    // Filter templates that are not associated yet
    const availableTemplates = globalTemplates.filter(gt =>
        !houseTemplates.some(ht => ht.template_task_id === gt.id)
    );

    return {
        dict,
        tasks,
        users,
        currentUser,
        globalTemplates,
        activeTab,
        setActiveTab,
        loadingTasks,
        submitting,
        showCreateForm,
        setShowCreateForm,
        houseTemplates,
        loadingHouseTemplates,
        selectedGlobalTemplateIds,
        setSelectedGlobalTemplateIds,
        templatePrices,
        setTemplatePrices,
        isLinking,
        editingTemplateId,
        setEditingTemplateId,
        editingTemplateValues,
        setEditingTemplateValues,
        title,
        setTitle,
        description,
        setDescription,
        assignedUserId,
        setAssignedUserId,
        price,
        setPrice,
        quantity,
        setQuantity,
        unit,
        setUnit,
        isAdminOrManager,
        canManageLocationTemplates,
        handleToggleStatus,
        handleCreateTask,
        handleLinkTemplates,
        handleUnlinkTemplate,
        handleUpdateTemplate,
        getAssigneeName,
        availableTemplates,
    };
}
