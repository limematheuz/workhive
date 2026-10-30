import type { TaskItemUpdate } from "@/types/task-update"
import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api"
import {
    buildTaskAcceptancePayload,
    type TaskAcceptanceInput,
} from "@/domain/tasks/task-acceptance"
import { TaskItem } from "@/types/user"
import { WorkStartLocation } from "@/lib/work-start-location"
import type { TaskPriority } from "@/types/task"
import { collectPaginated } from "@/lib/pagination"

export type { TaskItem };

export interface TaskItemCreate {
    title: string;
    description?: string | null;
    notes?: string | null;
    operational_notes?: TaskItem["operational_notes"];
    attachments?: TaskItem["attachments"];
    checklist_evidence?: TaskItem["checklist_evidence"];
    reported_issues?: TaskItem["reported_issues"];
    price?: number | null;
    quantity?: number | null;
    unit: string;
    pricing_mode?: "fixed" | "hourly";
    template_task_id?: number | null;
    location_id: number;
    user_id?: number | null;
    priority?: TaskPriority;
    created_at?: string | null;
    scheduled_start_at?: string | null;
    due_at?: string | null;
    service_context?: string;
    checkout_reservation_id?: number | null;
    next_reservation_id?: number | null;
    zone_ids?: number[];
    space_ids?: number[];
    space_task_template_ids?: number[];
}

export type { TaskItemUpdate } from "@/types/task-update";

export interface TaskItemFilters {
    locationId?: number;
    userId?: number;
    status?: string;
    skip?: number;
    limit?: number;
}

function notifyTasksChanged() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("workhive:tasks-changed"));
    }
}

export const TaskService = {
    getTaskItems: async (filters: TaskItemFilters = {}): Promise<TaskItem[]> => {
        const queryParams = new URLSearchParams()
        if (filters.locationId) queryParams.set("location_id", filters.locationId.toString())
        if (filters.userId) queryParams.set("user_id", filters.userId.toString())
        if (filters.status) queryParams.set("task_status", filters.status)
        if (filters.skip) queryParams.set("skip", filters.skip.toString())
        if (filters.limit) queryParams.set("limit", filters.limit.toString())

        const path = `/api/v1/task-items/?${queryParams.toString()}`
        const response = await apiFetch(path, {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching task items")
        return await response.json()
    },

    getAllTaskItems: async (
        filters: Omit<TaskItemFilters, "skip" | "limit"> = {},
    ): Promise<TaskItem[]> => collectPaginated(
        (skip, limit) => TaskService.getTaskItems({ ...filters, skip, limit }),
    ),

    getTaskItem: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching task details")
        return await response.json()
    },

    createTaskItem: async (data: TaskItemCreate): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error creating task item")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    duplicateTaskItem: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/duplicate`, { method: "POST" })
        await assertApiResponseOk(response, "Error duplicating task item")
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    updateTaskItem: async (id: number, data: TaskItemUpdate): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error updating task item")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    updateChecklistItem: async (
        taskId: number,
        checklistItemId: number,
        data: { completed: boolean; answer?: "yes" | "no" | null },
    ): Promise<TaskItem> => {
        const response = await apiFetch(
            `/api/v1/task-items/${taskId}/checklist-items/${checklistItemId}`,
            {
                method: "PATCH",
                body: JSON.stringify(data),
            },
        )
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error updating checklist item")
            )
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    deleteTaskItem: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/task-items/${id}`, {
            method: "DELETE"
        })
        await assertApiResponseOk(response, "Error deleting task item")
        notifyTasksChanged()
    },

    acceptTaskItem: async (id: number, input: TaskAcceptanceInput): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/accept`, {
            method: "POST",
            body: JSON.stringify(buildTaskAcceptancePayload(input))
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error accepting task")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    rejectTaskItem: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/reject`, {
            method: "POST"
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error rejecting task")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    startTaskWork: async (
        id: number,
        startLocation: WorkStartLocation,
        notes?: string
    ): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/start-work`, {
            method: "POST",
            body: JSON.stringify({
                notes: notes || null,
                ...startLocation,
            })
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error starting task work")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    },

    finishTaskWork: async (
        id: number,
        endLocation?: {
            end_latitude: number;
            end_longitude: number;
            end_accuracy_meters: number | null;
        }
    ): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/finish-work`, {
            method: "POST",
            body: JSON.stringify(endLocation ?? {})
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error finishing task work")
            throw new Error(errMsg)
        }
        const task = await response.json() as TaskItem
        notifyTasksChanged()
        return task
    }
}
