export type ClientPortalLine = {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_rate?: number | null;
    total?: number | null;
};

export type ClientPortalWorkspace = {
    id: number;
    company_name: string;
    client_name: string;
    status: "active" | "revoked";
    expires_at?: string | null;
};

export type ClientPortalInvoice = {
    id: number;
    invoice_number: string;
    issue_date: string;
    due_date?: string | null;
    status: string;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    is_rectification: boolean;
    original_invoice_id?: number | null;
    payment_method?: string | null;
    paid_at?: string | null;
    lines: ClientPortalLine[];
};

export type ClientPortalQuote = {
    id: number;
    quote_number: string;
    title: string;
    status: string;
    valid_until?: string | null;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    terms?: string | null;
    revision_number: number;
    lines: ClientPortalLine[];
};

export type ClientPortalContractLocation = {
    location_name?: string | null;
    covered_from: string;
    covered_until?: string | null;
    zone_names: string[];
};

export type ClientPortalContract = {
    id: number;
    contract_number: string;
    title: string;
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    renewal_mode: string;
    renewal_notice_days: number;
    response_time_hours?: number | null;
    resolution_time_hours?: number | null;
    service_window?: string | null;
    lines: ClientPortalLine[];
    covered_locations: ClientPortalContractLocation[];
};

export type ClientPortalInspectionItem = {
    title: string;
    status: "not_assessed" | "passed" | "failed" | string;
    points_awarded: number;
    max_points: number;
};

export type ClientPortalInspectionAcceptance = {
    signer_name: string;
    statement_version: string;
    signed_at: string;
};

export type ClientPortalInspection = {
    id: number;
    template_title: string;
    location_name: string;
    completed_at: string;
    score: number;
    max_score: number;
    items: ClientPortalInspectionItem[];
    acceptance: ClientPortalInspectionAcceptance | null;
};

export type ClientPortalComplaintLocation = {
    id: number;
    name: string;
};

export type ClientPortalComplaint = {
    id: number;
    location_id: number;
    location_name: string;
    title: string;
    description: string;
    category: "service" | "billing" | "damage" | "other";
    status: "submitted" | "in_review" | "resolved" | "closed";
    customer_response: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
};

export type ClientPortalComplaintPayload = {
    location_id: number;
    title: string;
    description: string;
    category: ClientPortalComplaint["category"];
};

export type ClientPortalOverview = {
    workspace: ClientPortalWorkspace;
    invoices: ClientPortalInvoice[];
    quotes: ClientPortalQuote[];
    contracts: ClientPortalContract[];
    inspections: ClientPortalInspection[];
    complaint_locations: ClientPortalComplaintLocation[];
    complaints: ClientPortalComplaint[];
};

export type ClientPortalInvitation = {
    id: number;
    email: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    expires_at: string;
    created_at: string;
};

export type ClientPortalGrant = {
    id: number;
    email: string;
    full_name?: string | null;
    status: "active" | "revoked";
    expires_at?: string | null;
    created_at: string;
};

export type ClientPortalInvitationAcceptPayload = {
    token: string;
    verification_code: string;
    full_name: string;
    password?: string;
    accept_terms: boolean;
    accept_privacy: boolean;
    marketing_consent?: boolean;
};

export type ClientPortalInspectionAcceptancePayload = {
    confirmed: boolean;
    signer_name: string;
};
