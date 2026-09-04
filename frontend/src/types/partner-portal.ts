import type { Location } from "@/types/location";
import type { Reservation, ReservationInput } from "@/types/reservation";

export type PartnerPortalOverview = {
    host_company_id: number;
    host_company_name: string;
    partner_company_id: number;
    partner_company_name: string;
    location_count: number;
    upcoming_reservation_count: number;
    pending_cleaning_count: number;
};

export type PartnerPortalReservationInput = Omit<ReservationInput, "assigned_company_id" | "cleaning_required">;

export type PartnerPortalData = {
    overview: PartnerPortalOverview;
    locations: Location[];
    reservations: Reservation[];
};

export type PartnerPortalCandidate = {
    id: number;
    full_name: string | null;
    email: string;
    role_name: string;
    eligible: boolean;
    ineligible_reason: string | null;
};

export type PartnerPortalGrant = {
    id: number;
    host_company_id: number;
    partner_company_id: number;
    collaboration_id: number;
    user_id: number;
    status: "active" | "revoked";
    expires_at: string | null;
    created_at: string;
    revoked_at: string | null;
    user_full_name: string | null;
    user_email: string;
};
