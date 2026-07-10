export interface QuoteItem {
    id: number;
    quote_id: number;
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    created_at: string;
    updated_at: string;
}

export interface Quote {
    id: number;
    quote_number: string;
    title: string;
    status: "draft" | "sent" | "accepted" | "rejected" | "expired";
    client_id: number | null;
    company_id: number;
    valid_until: string | null;
    notes: string | null;
    tax_rate: number;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    discount: number;
    equivalence_surcharge: number;
    retention: number;
    terms: string | null;
    shipping_address: string | null;
    custom_issuer_info: string | null;
    custom_recipient_info: string | null;
    signature_url: string | null;
    items: QuoteItem[];
    created_at: string;
    updated_at: string;
}
