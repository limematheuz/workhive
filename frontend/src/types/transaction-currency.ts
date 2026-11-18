export type CurrencyKind = "invoices" | "expenses" | "payments" | "sales";
export type CurrencyAmounts = { base_amount?: string | null; tax_amount?: string | null; total_amount: string };
export type CurrencyLine = { description: string; quantity: string; unit_price: string; tax_rate?: string | null; subtotal: string; total?: string | null };
export type PublicCurrencySnapshot = {
    currency: string;
    eur_rate: string;
    rate_date: string;
    original_amounts: CurrencyAmounts;
    eur_amounts: CurrencyAmounts;
    original_lines?: CurrencyLine[];
    rounding_difference_eur?: string | null;
};
export type CurrencySnapshot = PublicCurrencySnapshot & {
    original_document: Record<string, unknown>;
    realized_exchange_difference_eur?: string;
};
export type CurrencyRecord = {
    id: number; kind: CurrencyKind; label: string; status: string; editable: boolean;
    amount_eur: string; currency_snapshot: CurrencySnapshot;
    edit_document?: Record<string, unknown>;
};
export type CurrencyInvoiceOption = { id: number; number: string; client_id: number; outstanding_eur: string; currency_snapshot: CurrencySnapshot | null };
export type CurrencyWorkspace = {
    currencies: string[]; minor_units: Record<string, number>;
    clients: Array<{ id: number; name: string }>;
    invoices: CurrencyInvoiceOption[]; records: CurrencyRecord[]; can_manage: boolean;
};
export type CurrencyPayload = {
    currency: string; eur_rate: string; rate_date: string; rate_verified: true;
    document: Record<string, unknown>; settle_invoice_id?: number; settled_native_amount?: string;
};
