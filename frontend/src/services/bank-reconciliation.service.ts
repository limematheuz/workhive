import { apiFetch } from "@/lib/api";

export type BankStatementEntryStatus = "unmatched" | "matched";

export type ReconciledCustomerPayment = {
    id: number;
    client_id: number;
    received_at: string;
    amount: number;
    reference: string | null;
    status: "received" | "voided";
};

export type BankReconciliation = {
    id: number;
    customer_payment_id: number;
    status: "matched" | "reversed";
    matched_at: string;
    matched_by_user_id: number | null;
    reversed_at: string | null;
    reversed_by_user_id: number | null;
    reversal_reason: string | null;
    payment: ReconciledCustomerPayment;
};

export type BankStatementEntry = {
    id: number;
    booked_at: string;
    amount: number;
    currency: string;
    account_label: string | null;
    external_id: string | null;
    reference: string | null;
    counterparty: string | null;
    notes: string | null;
    status: BankStatementEntryStatus;
    created_by_user_id: number | null;
    created_at: string;
    current_reconciliation: BankReconciliation | null;
};

export type BankStatementEntryCreate = {
    booked_at: string;
    amount: string;
    currency?: string;
    account_label?: string | null;
    external_id?: string | null;
    reference?: string | null;
    counterparty?: string | null;
    notes?: string | null;
};

export const BankReconciliationService = {
    getEntries: async (entryStatus?: BankStatementEntryStatus): Promise<BankStatementEntry[]> => {
        const suffix = entryStatus ? `?entry_status=${entryStatus}` : "";
        const response = await apiFetch(`/api/v1/bank-reconciliation/entries${suffix}`);
        return response.json();
    },

    createEntry: async (payload: BankStatementEntryCreate): Promise<BankStatementEntry> => {
        const response = await apiFetch("/api/v1/bank-reconciliation/entries", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return response.json();
    },

    matchEntry: async (entryId: number, customerPaymentId: number): Promise<BankStatementEntry> => {
        const response = await apiFetch(`/api/v1/bank-reconciliation/entries/${entryId}/match`, {
            method: "POST",
            body: JSON.stringify({ customer_payment_id: customerPaymentId }),
        });
        return response.json();
    },

    unmatchEntry: async (entryId: number, reason: string): Promise<BankStatementEntry> => {
        const response = await apiFetch(`/api/v1/bank-reconciliation/entries/${entryId}/unmatch`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
        return response.json();
    },
};
