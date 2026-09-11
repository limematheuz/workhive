export type WorkSessionCorrectionStatus = "pending" | "approved" | "rejected";

export type WorkSessionCorrection = {
    id: number;
    company_id: number;
    work_session_id: number;
    requested_by_user_id: number | null;
    requester_name: string | null;
    location_id: number | null;
    location_name: string | null;
    original_start_time: string;
    original_end_time: string;
    requested_start_time: string;
    requested_end_time: string;
    reason: string;
    status: WorkSessionCorrectionStatus;
    reviewed_by_user_id: number | null;
    reviewed_at: string | null;
    review_note: string | null;
    applied_at: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkSessionCorrectionCreate = {
    requested_start_time: string;
    requested_end_time: string;
    reason: string;
};

export type WorkSessionCorrectionReview = {
    decision: "approved" | "rejected";
    note?: string;
};
