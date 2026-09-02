import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ReadonlyURLSearchParams } from "next/navigation";

import {
    getReservationAssigneeName,
    getReservationLocationName,
    loadInitialTaskDataForPage,
    loadRequestedTasksForPage,
} from "@/features/reservations/reservations-page-utils";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import type { Dictionary } from "@/lib/dictionary-context";
import { TaskService, type TaskItem } from "@/services/task.service";
import type { TaskAcceptanceInput } from "@/domain/tasks/task-acceptance";
import type { Location } from "@/types/location";
import type { TemplateTask } from "@/types/template";
import type { User } from "@/types/user";

type Options = {
    user: User | null;
    dict: Dictionary;
    locations: Location[];
    searchParams: ReadonlyURLSearchParams;
    canManage: boolean;
    hasPlanningAccess: boolean | null;
};

export function useReservationRequests({
    user,
    dict,
    locations,
    searchParams,
    canManage,
    hasPlanningAccess,
}: Options) {
    const [requestedTasks, setRequestedTasks] = useState<TaskItem[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<TemplateTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    const displayRequestedTasks = useMemo(
        () => (user ? requestedTasks : []),
        [requestedTasks, user],
    );
    const loadRequestedTasks = useCallback(
        (silent = false) =>
            loadRequestedTasksForPage(setRequestedTasks, setLoadingTasks, silent),
        [],
    );
    const loadInitialTaskData = useCallback(
        () => loadInitialTaskDataForPage(user, setUsers, setTemplates),
        [user],
    );

    useEffect(() => {
        if (!hasPlanningAccess || !canManage) return;
        void loadRequestedTasks();
        void loadInitialTaskData();
    }, [hasPlanningAccess, canManage, loadInitialTaskData, loadRequestedTasks]);

    const taskCrud = useTaskCrud({
        dict,
        templates,
        loadTasks: loadRequestedTasks,
        setTasks: setRequestedTasks,
        users,
        currentUser: user,
        canManageReservationsForLocation: () => false,
    });

    const openTaskFromUrl = useEffectEvent((taskId: string | null) => {
        if (!taskId || requestedTasks.length === 0) return;
        const task = requestedTasks.find((item) => item.id === Number(taskId));
        if (task && (!taskCrud.selectedTask || taskCrud.selectedTask.id !== task.id)) {
            taskCrud.handleOpenDetail(task);
        }
    });

    useEffect(() => {
        openTaskFromUrl(searchParams.get("taskId"));
    }, [searchParams, requestedTasks]);

    const handleRejectTask = async (taskId: number) => {
        try {
            await TaskService.rejectTaskItem(taskId);
            toast.success("Solicitud rechazada");
            await loadRequestedTasks();
        } catch (error) {
            console.error("Error rejecting task:", error);
            toast.error("No se pudo rechazar la solicitud");
        }
    };
    const handleAcceptTask = async (taskId: number, input: TaskAcceptanceInput) => {
        try {
            await TaskService.acceptTaskItem(taskId, input);
            toast.success("Solicitud aceptada con éxito");
            await loadRequestedTasks();
        } catch (error) {
            console.error("Error accepting task:", error);
            toast.error("No se pudo aceptar la solicitud");
            throw error;
        }
    };

    return {
        displayRequestedTasks,
        getAssigneeName: (userId: number | null) =>
            getReservationAssigneeName(userId, users, user),
        getLocationName: (locationId: number) =>
            getReservationLocationName(locationId, locations),
        handleAcceptTask,
        handleRejectTask,
        loadingTasks,
        loadRequestedTasks,
        taskCrud,
        users,
    };
}
