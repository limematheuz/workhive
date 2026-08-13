export interface InvoiceItem {
    id: number;
    invoice_id: number;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    subtotal: number;
    total: number;
    task_item_id?: number | null;
    created_at: string;
    updated_at: string;
}

export type InvoicePaymentMethod =
    | "bank_transfer"
    | "direct_debit"
    | "card"
    | "cash"
    | "bizum"
    | "other";

export interface Invoice {
    id: number;
    invoice_number: string;
    client_id: number;
    company_id: number;
    issue_date: string;
    due_date?: string | null;
    status: "draft" | "issued" | "paid" | "overdue" | "cancelled" | "rectified";
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    is_rectification: boolean;
    original_invoice_id?: number | null;
    invoice_hash?: string | null;
    previous_invoice_hash?: string | null;
    issued_at?: string | null;
    paid_at?: string | null;
    issuer_snapshot?: Record<string, unknown> | null;
    recipient_snapshot?: Record<string, unknown> | null;
    rectification_reason?: string | null;
    rectification_reason_code?: string | null;
    fiscal_submission_status: "not_configured" | "ready_for_test_submission" | "accepted" | "rejected" | string;
    qr_url?: string | null;
    aeat_csv?: string | null;
    pdf_sha256?: string | null;
    pdf_generated_at?: string | null;
    facturae_sha256?: string | null;
    facturae_generated_at?: string | null;
    facturae_signed_at?: string | null;
    facturae_signature_status?: "not_generated" | "unsigned" | "signed" | string;
    discount: number;
    equivalence_surcharge: number;
    retention: number;
    payment_method?: InvoicePaymentMethod | null;
    notes?: string | null;
    terms?: string | null;
    shipping_address?: string | null;
    custom_issuer_info?: string | null;
    custom_recipient_info?: string | null;
    signature_url?: string | null;
    items: InvoiceItem[];
    created_at: string;
    updated_at: string;
}
