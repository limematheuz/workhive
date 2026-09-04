import type { WorkSessionStartLocation } from "./user";

export interface Reservation {
    id: number;
    location_id: number;
    owner_company_id: number;
    owner_company_name?: string | null;
    check_in_at: string;
    check_out_at: string;
    guest_count: number;
    stay_type: "guest" | "owner" | "block";
    status: "confirmed" | "tentative" | "cancelled";
    source: string;
    external_reference?: string | null;
    notes?: string | null;
    cleaning_required: boolean;
    created_by_user_id?: number | null;
    updated_by_user_id?: number | null;
    created_at: string;
    updated_at: string;
    assigned_company_id?: number | null;
    assigned_company_name?: string | null;
    cleaning_status?: string | null;
    cleaning_scheduled_at?: string | null;
    service_request_sent_at?: string | null;
    cleaning_start_locations?: WorkSessionStartLocation[];
}

export interface ReservationInput {
    location_id: number;
    check_in_at: string;
    check_out_at: string;
    guest_count: number;
    stay_type: "guest" | "owner" | "block";
    status: "confirmed" | "tentative" | "cancelled";
    source: string;
    external_reference?: string | null;
    notes?: string | null;
    cleaning_required: boolean;
    assigned_company_id?: number | null;
    cleaning_scheduled_at?: string | null;
}
