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

export type ClientPortalOverview = {
    workspace: ClientPortalWorkspace;
    invoices: ClientPortalInvoice[];
    quotes: ClientPortalQuote[];
    contracts: ClientPortalContract[];
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
