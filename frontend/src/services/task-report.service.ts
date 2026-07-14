import { apiFetch, extractErrorMessage } from "@/lib/api";


export type TaskReportType = "issue" | "note" | "photo" | "checklist_note" | "checklist_photo";

export interface TaskReport {
    id: number;
    task_item_id: number;
    reporter_user_id: number | null;
    reporter_company_id: number;
    requesting_company_id: number | null;
    report_type: TaskReportType;
    title: string | null;
    description: string | null;
    issue_type: string | null;
    element: string | null;
    file_name: string | null;
    checklist_item_id: number | null;
    checklist_item_label: string | null;
    reporter_name: string;
    reporter_company_name: string;
    requesting_company_name: string | null;
    task_title: string;
    location_name: string;
    media_url: string | null;
    created_at: string;
}

type CreateTaskReport = {
    task_item_id: number;
    report_type: TaskReportType;
    title?: string;
    description?: string;
    issue_type?: string;
    element?: string;
    media_url?: string;
    file_name?: string;
    checklist_item_id?: number;
};

async function parseReportResponse(response: Response): Promise<TaskReport> {
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "No se pudo enviar el reporte"));
    }
    return await response.json();
}

export const TaskReportService = {
    list: async (): Promise<TaskReport[]> => {
        const reports: TaskReport[] = [];
        const pageSize = 200;
        for (let skip = 0; ; skip += pageSize) {
            const response = await apiFetch(
                `/api/v1/task-reports/?skip=${skip}&limit=${pageSize}`,
                { cache: "no-store" },
            );
            if (!response.ok) {
                throw new Error(await extractErrorMessage(response, "No se pudo cargar el historial"));
            }
            const page: TaskReport[] = await response.json();
            reports.push(...page);
            if (page.length < pageSize) break;
        }
        return reports;
    },

    create: async (payload: CreateTaskReport): Promise<TaskReport> => {
        const response = await apiFetch("/api/v1/task-reports/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, client_event_id: crypto.randomUUID() }),
        });
        return parseReportResponse(response);
    },

    createChecklistNote: async (
        taskItemId: number,
        checklistItemId: number,
        description: string,
    ): Promise<TaskReport> => TaskReportService.create({
        task_item_id: taskItemId,
        checklist_item_id: checklistItemId,
        report_type: "checklist_note",
        description,
    }),

    createChecklistPhoto: async (
        taskItemId: number,
        checklistItemId: number,
        mediaUrl: string,
        fileName: string,
    ): Promise<TaskReport> => TaskReportService.create({
        task_item_id: taskItemId,
        checklist_item_id: checklistItemId,
        report_type: "checklist_photo",
        media_url: mediaUrl,
        file_name: fileName,
    }),

    markNotificationsRead: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/task-reports/notifications/read", {
            method: "PATCH",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudieron limpiar las alertas"));
        }
    },
};
