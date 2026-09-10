import { Role } from "./role";
import { Reservation } from "./reservation";
import type { TaskPriority, TaskStatusValue } from "./task";

export interface User {
    id: number;
    email: string;
    full_name?: string;
    role_id: number;
    role: Role;
    company_id?: number | null;
    is_active?: boolean;
    photo_url?: string | null;
    active_location_id?: number | null;
    active_location_name?: string | null;
    can_view_finance?: boolean;
    can_manage_finance?: boolean;
}

export interface UserStatsResponse {
    total_hours_worked: number;
    tasks_completed: number;
    tasks_pending: number;
    total_tasks: number;
    active_session_id: number | null;
    locations_worked_count: number;
}

export interface WorkSession {
    id: number;
    user_id: number | null;
    notes: string;
    location_id: number;
    task_item_id?: number | null;
    start_latitude?: number | null;
    start_longitude?: number | null;
    start_accuracy_meters?: number | null;
    start_time: string;
    end_time: string | null;
    end_latitude?: number | null;
    end_longitude?: number | null;
    end_accuracy_meters?: number | null;
    paused_at?: string | null;
    paused_seconds?: number;
    created_at: string;
    updated_at: string;
}

export interface ActiveCompanySession extends WorkSession {
    user_name: string;
    user_email: string;
    worker_company_id: number;
    worker_company_name: string;
    visibility_scope: "own" | "collaborator";
    location_name: string;
    task_title?: string | null;
    elapsed_seconds: number;
}

export interface TaskWorkSummary {
    task_item_id: number;
    total_seconds: number;
    active_workers: number;
    session_count: number;
}

export interface TaskItem {
    id: number;
    title: string;
    description?: string | null;
    notes?: string | null;
    operational_notes?: Array<{
        author: string;
        text: string;
        date: string;
    }>;
    attachments?: Array<{
        url: string;
        date: string;
        name?: string;
    }>;
    checklist_evidence?: Record<string, {
        answer?: "yes" | "no" | null;
        note?: string;
        photoUrl?: string;
        photoName?: string;
    }>;
    reported_issues?: ReportedIssue[];
    price?: number | null;
    quantity?: number | null;
    unit: string;
    pricing_mode?: "fixed" | "hourly";
    worked_seconds_snapshot?: number | null;
    pricing_locked_at?: string | null;
    billing_pricing_mode_snapshot?: "fixed" | "hourly" | null;
    billing_price_snapshot?: number | null;
    billing_quantity_snapshot?: number | null;
    billing_unit_snapshot?: string | null;
    template_task_id?: number | null;
    service_catalog_version_id?: number | null;
    location_id: number;
    user_id: number | null;
    status: TaskStatusValue;
    priority: TaskPriority;
    scheduled_start_at?: string | null;
    due_at?: string | null;
    service_context?: "standalone" | "turnover" | "pre_arrival" | "maintenance" | string;
    checkout_reservation_id?: number | null;
    next_reservation_id?: number | null;
    checkout_reservation?: Pick<Reservation, "id" | "location_id" | "owner_company_id" | "owner_company_name" | "check_in_at" | "check_out_at" | "guest_count" | "stay_type" | "status" | "notes"> | null;
    next_reservation?: Pick<Reservation, "id" | "location_id" | "owner_company_id" | "owner_company_name" | "check_in_at" | "check_out_at" | "guest_count" | "stay_type" | "status" | "notes"> | null;
    date_done?: string | null;
    is_invoiced: boolean;
    created_at: string;
    updated_at: string;
    user_company_id?: number | null;
    accepted_by_user_id?: number | null;
    accepted_by_name?: string | null;
    checklist_items?: TaskChecklistItem[];
    assignments?: TaskAssignment[];
    zones?: TaskZone[];
    spaces?: TaskZone[];
}

export interface TaskZone {
    id: number;
    space_id: number;
    name: string;
    zone_type: string;
}

export interface TaskChecklistAssignment {
    user_id: number;
    user_name: string;
    status: TaskStatusValue;
}

export interface TaskChecklistItem {
    id: number;
    position: number;
    space_name?: string | null;
    text: string;
    completed: boolean;
    assignments: TaskChecklistAssignment[];
}

export interface TaskAssignment extends TaskChecklistAssignment {
    source: "checklist" | "all" | "direct" | string;
}

export interface ReportedIssue {
    id: string;
    type: "mantenimiento" | "limpieza" | "inspeccion";
    element: string;
    title: string;
    description: string;
    photoUrl?: string;
    createdAt: string;
}

export interface WorkerTimeSummary {
    user_id: number;
    user_name: string;
    total_seconds: number;
    is_active: boolean;
}

export interface TaskWorkDetailedSummary {
    task_item_id: number;
    total_seconds: number;
    active_workers: number;
    session_count: number;
    workers: WorkerTimeSummary[];
    start_locations: WorkSessionStartLocation[];
}

export interface WorkSessionStartLocation {
    session_id: number;
    user_id: number;
    user_name: string;
    started_at: string;
    latitude: number;
    longitude: number;
    accuracy_meters?: number | null;
}
