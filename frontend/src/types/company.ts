export interface Company {
    id: number;
    name: string;
    cif?: string;
    tax_id?: string;
    address?: string;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    phone?: string;
    email?: string;
    contact_email?: string | null;
    logo?: string | null;
    iban?: string;
    bank_account?: string | null;
    swift_bic?: string | null;
    default_payment_notes?: string | null;
    default_document_terms?: string | null;
    subscription_plan?: "trial" | "free" | "pro" | "none" | string;
    subscription_status?: "trialing" | "active" | "inactive" | "expired" | "canceled" | string;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    is_active: boolean;
    onboarding_completed?: boolean;
    operating_model?: "service_provider" | "property_manager" | "hybrid" | null;
}

export interface CompanyExpense {
    task_id: number;
    occurred_at: string;
    amount: number;
    provider_company_id: number;
    provider_company_name: string;
}
