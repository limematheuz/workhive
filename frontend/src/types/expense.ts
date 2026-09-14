export interface Expense {
    id: number;
    company_id: number;
    client_id?: number | null;
    service_contract_id?: number | null;
    work_order_id?: number | null;
    created_by_user_id?: number | null;
    expense_date: string;
    vendor?: string | null;
    category: string;
    description: string;
    payment_method?: string | null;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    receipt_url?: string | null;
    notes?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ExpensePayload {
    expense_date: string;
    client_id?: number | null;
    service_contract_id?: number | null;
    work_order_id?: number | null;
    vendor?: string | null;
    category: string;
    description: string;
    payment_method?: string | null;
    base_amount: number;
    tax_amount?: number;
    receipt_url?: string | null;
    notes?: string | null;
}
