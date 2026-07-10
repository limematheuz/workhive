import { apiFetch, extractErrorMessage } from "@/lib/api"
import { TaskItem } from "@/types/user"
import { WorkStartLocation } from "@/lib/work-start-location"
import type { TaskPriority, TaskStatus } from "@/types/task"

export type { TaskItem };

export interface TaskItemCreate {
    title: string;
    description?: string | null;
    notes?: string | null;
    operational_notes?: TaskItem["operational_notes"];
    attachments?: TaskItem["attachments"];
    checklist_evidence?: TaskItem["checklist_evidence"];
    price?: number | null;
    quantity?: number | null;
    unit: string;
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
}

export interface TaskItemUpdate {
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    operational_notes?: TaskItem["operational_notes"];
    attachments?: TaskItem["attachments"];
    checklist_evidence?: TaskItem["checklist_evidence"];
    price?: number | null;
    quantity?: number | null;
    unit?: string | null;
    status?: TaskStatus | null;
    template_task_id?: number | null;
    location_id?: number | null;
    user_id?: number | null;
    date_done?: string | null;
    priority?: TaskPriority | null;
    created_at?: string | null;
    scheduled_start_at?: string | null;
    due_at?: string | null;
    service_context?: string | null;
    checkout_reservation_id?: number | null;
    next_reservation_id?: number | null;
}

export interface TaskItemFilters {
    locationId?: number;
    userId?: number;
    status?: string;
    skip?: number;
    limit?: number;
}

export const TaskService = {
    getTaskItems: async (filters: TaskItemFilters = {}): Promise<TaskItem[]> => {
        const queryParams = new URLSearchParams()
        if (filters.locationId) queryParams.set("location_id", filters.locationId.toString())
        if (filters.userId) queryParams.set("user_id", filters.userId.toString())
        if (filters.status) queryParams.set("task_status", filters.status)
        if (filters.skip) queryParams.set("skip", filters.skip.toString())
        if (filters.limit) queryParams.set("limit", filters.limit.toString())

        const response = await apiFetch(`/api/v1/task-items/?${queryParams.toString()}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error fetching task items")
            )
        }
        return await response.json()
    },

    getTaskItem: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching task details")
        }
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
        return await response.json()
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
        return await response.json()
    },

    deleteTaskItem: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/task-items/${id}`, {
            method: "DELETE"
        })
        // DELETE is idempotent. A stale Kanban card may point to a task that was
        // already removed by reservation reconciliation or another open tab.
        if (response.status === 404) {
            return
        }
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error deleting task item")
            throw new Error(errMsg)
        }
    },

    acceptTaskItem: async (id: number, scheduledStartAt?: string): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/accept`, {
            method: "POST",
            body: JSON.stringify({
                scheduled_start_at: scheduledStartAt || null
            })
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error accepting task")
            throw new Error(errMsg)
        }
        return await response.json()
    },

    rejectTaskItem: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/reject`, {
            method: "POST"
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error rejecting task")
            throw new Error(errMsg)
        }
        return await response.json()
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
        return await response.json()
    },

    finishTaskWork: async (id: number): Promise<TaskItem> => {
        const response = await apiFetch(`/api/v1/task-items/${id}/finish-work`, {
            method: "POST"
        })
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "Error finishing task work")
            throw new Error(errMsg)
        }
        return await response.json()
    }
}
