export interface Client {
    id: number;
    name: string;
    client_type: "individual" | "business" | "company";
    relationship_status?: "lead" | "client";
    email?: string | null;
    phone?: string | null;
    address: string;
    city: string;
    province?: string | null;
    postal_code: string;
    country: string;
    legal_number?: string | null;
    is_active: boolean;
    company_id: number;
    account_assignment?: ClientAccountAssignment | null;
}

export interface ClientAccountAssignment {
    id: number;
    client_id: number;
    company_id: number;
    membership_id: number;
    owner_name: string | null;
    owner_email: string | null;
    assigned_by_user_id: number | null;
    started_at: string;
    ended_at: string | null;
}

export interface ClientAccountAssignmentCandidate {
    membership_id: number;
    full_name: string;
    email: string;
}

export interface ClientPortfolioItem {
    client: Client;
    assignment: ClientAccountAssignment;
}

export interface ClientAccess {
    can_read_clients: boolean;
    can_manage_clients: boolean;
    can_read_commercial_follow_ups: boolean;
    can_manage_commercial_follow_ups: boolean;
}

export type ClientContactRole =
    | "commercial"
    | "billing"
    | "operations"
    | "quality"
    | "emergency"
    | "general";

export interface ClientContact {
    id: number;
    client_id: number;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
    roles: ClientContactRole[];
    is_primary: boolean;
    is_active: boolean;
}

export type ClientContactPayload = Omit<ClientContact, "id" | "client_id">;

export type ClientOpportunityStage =
    | "new"
    | "qualified"
    | "proposal"
    | "negotiation"
    | "won"
    | "lost";

export type ClientOpportunityActivityType = "note" | "call" | "email" | "meeting";
export type ClientOpportunityActivityResponseType = ClientOpportunityActivityType | "stage_change";

export interface ClientOpportunity {
    id: number;
    client_id: number;
    contact_id: number | null;
    owner_membership_id: number | null;
    owner_name: string | null;
    created_by_user_id: number | null;
    title: string;
    stage: ClientOpportunityStage;
    next_follow_up_at: string | null;
    loss_reason: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type ClientOpportunityPayload = Pick<
    ClientOpportunity,
    "title" | "contact_id" | "owner_membership_id" | "stage" | "next_follow_up_at" | "loss_reason"
>;

export interface ClientOpportunityOwner {
    membership_id: number;
    user_id: number;
    full_name: string;
    email: string;
    access_class: "admin" | "responsible" | "worker";
}

export interface ClientOpportunityActivity {
    id: number;
    opportunity_id: number;
    created_by_user_id: number | null;
    actor_name: string | null;
    activity_type: ClientOpportunityActivityResponseType;
    body: string | null;
    stage_from: ClientOpportunityStage | null;
    stage_to: ClientOpportunityStage | null;
    happened_at: string;
    created_at: string;
}
