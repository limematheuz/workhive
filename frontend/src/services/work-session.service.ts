import { apiFetch } from "@/lib/api"
import { ActiveCompanySession, TaskWorkSummary, TaskWorkDetailedSummary, WorkSession } from "@/types/user"

export type { WorkSession };

export interface WorkSessionCreate {
    notes: string;
    location_id: number;
    task_item_id: number;
    start_latitude: number;
    start_longitude: number;
    start_accuracy_meters?: number | null;
}

export const WorkSessionService = {
    getWorkSessions: async (skip: number = 0, limit: number = 100): Promise<WorkSession[]> => {
        const response = await apiFetch(`/api/v1/work-sessions/?skip=${skip}&limit=${limit}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching work sessions")
        }
        return await response.json()
    },

    getActiveSession: async (): Promise<WorkSession | null> => {
        const response = await apiFetch(`/api/v1/work-sessions/active`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching active session")
        }
        return await response.json()
    },

    getActiveCompanySessions: async (): Promise<ActiveCompanySession[]> => {
        const response = await apiFetch(`/api/v1/work-sessions/company/active`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching active company sessions")
        }
        return await response.json()
    },

    getTaskSummary: async (taskItemId: number): Promise<TaskWorkSummary> => {
        const response = await apiFetch(`/api/v1/work-sessions/task/${taskItemId}/summary`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching task work summary")
        }
        return await response.json()
    },

    getTaskDetailedSummary: async (taskItemId: number): Promise<TaskWorkDetailedSummary> => {
        const response = await apiFetch(`/api/v1/work-sessions/task/${taskItemId}/detailed-summary`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching task detailed work summary")
        }
        return await response.json()
    },

    getTaskDetailedSummaries: async (taskItemIds: number[]): Promise<TaskWorkDetailedSummary[]> => {
        const ids = [...new Set(taskItemIds)];
        if (ids.length === 0) return [];

        const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
            ids.slice(index * 100, (index + 1) * 100),
        );
        const responses = await Promise.all(batches.map(async (batch) => {
            const params = new URLSearchParams();
            batch.forEach((taskItemId) => params.append("task_item_ids", taskItemId.toString()));
            const response = await apiFetch(`/api/v1/work-sessions/tasks/detailed-summaries?${params}`, {
                method: "GET",
                cache: "no-store",
            });
            if (!response.ok) {
                throw new Error("Error fetching task detailed work summaries");
            }
            return (await response.json() as { summaries: TaskWorkDetailedSummary[] }).summaries;
        }));
        return responses.flat();
    },

    getWorkSession: async (id: number): Promise<WorkSession> => {
        const response = await apiFetch(`/api/v1/work-sessions/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching work session details")
        }
        return await response.json()
    },

    startSession: async (data: WorkSessionCreate): Promise<WorkSession> => {
        const response = await apiFetch(`/api/v1/work-sessions/start`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error starting work session")
        }
        return await response.json()
    },

    stopSession: async (): Promise<WorkSession> => {
        const response = await apiFetch(`/api/v1/work-sessions/stop`, {
            method: "POST"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error stopping work session")
        }
        return await response.json()
    }
}
