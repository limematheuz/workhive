import type { TaskItem } from "./user";
import type { TaskPriority, TaskStatus } from "./task";

export interface TaskChecklistEdit {
    id: number;
    completed?: boolean;
    assigned_user_ids?: number[];
}

export interface TaskItemUpdate {
    checklist_updates?: TaskChecklistEdit[];
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    operational_notes?: TaskItem["operational_notes"];
    attachments?: TaskItem["attachments"];
    checklist_evidence?: TaskItem["checklist_evidence"];
    reported_issues?: TaskItem["reported_issues"];
    price?: number | null;
    quantity?: number | null;
    unit?: string | null;
    pricing_mode?: "fixed" | "hourly" | null;
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
    zone_ids?: number[] | null;
    space_ids?: number[] | null;
}
