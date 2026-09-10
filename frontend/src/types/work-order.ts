export type WorkOrderStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type WorkOrderType = "one_off" | "recurring";
export type RecurrenceUnit = "weekly" | "monthly";

export type WorkOrder = {
    id: number;
    title: string;
    description: string | null;
    status: WorkOrderStatus;
    order_type: WorkOrderType;
    location_id: number;
    service_contract_id: number | null;
    scheduled_start_at: string;
    next_occurrence_at: string | null;
    recurrence_unit: RecurrenceUnit | null;
    recurrence_interval: number | null;
    recurrence_ends_at: string | null;
    estimated_people: number | null;
    estimated_minutes: number | null;
    created_at: string;
    updated_at: string | null;
};

export type WorkOrderCreate = {
    title: string;
    location_id: number;
    service_contract_id?: number;
    description?: string;
    status: "draft" | "active";
    order_type: WorkOrderType;
    scheduled_start_at: string;
    recurrence_unit?: RecurrenceUnit;
    recurrence_interval?: number;
    recurrence_ends_at?: string;
    estimated_people?: number;
    estimated_minutes?: number;
};

export type WorkOrderContractCandidate = {
    contract_id: number;
    contract_title: string;
    location_id: number;
    location_name: string;
};
