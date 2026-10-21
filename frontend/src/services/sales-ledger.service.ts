import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type SalesLedgerSourceType = "invoice" | "manual";
export type SalesLedgerPaymentStatus = "paid" | "pending";

export type SalesLedgerEntry = {
    source_type: SalesLedgerSourceType;
    source_id: number;
    document_number: string;
    entry_date: string;
    client_name: string;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    payment_status: SalesLedgerPaymentStatus;
    invoice_status?: string | null;
    is_rectification?: boolean | null;
    collected_amount?: number | null;
    is_editable: boolean;
    created_at?: string | null;
    updated_at?: string | null;
};

export type SalesLedgerManualRecordInput = {
    document_number: string;
    entry_date: string;
    client_name: string;
    base_amount: number;
    tax_amount: number;
    payment_status: SalesLedgerPaymentStatus;
};

export type SalesLedgerCsvError = {
    row: number;
    message: string;
};

export type SalesLedgerCsvPreview = {
    valid_rows: number;
    errors: SalesLedgerCsvError[];
};

function queryString(filters: { year?: number; search?: string; skip?: number; limit?: number }): string {
    const params = new URLSearchParams();
    if (filters.year) params.set("year", String(filters.year));
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.skip) params.set("skip", String(filters.skip));
    if (filters.limit) params.set("limit", String(filters.limit));
    return params.toString();
}

async function uploadCsv(path: string, file: File): Promise<Response> {
    const formData = new FormData();
    formData.set("file", file);
    return apiFetch(path, { method: "POST", body: formData });
}

export const SalesLedgerService = {
    async getEntries(filters: { year?: number; search?: string; skip?: number; limit?: number } = {}): Promise<SalesLedgerEntry[]> {
        const query = queryString(filters);
        const response = await apiFetch(`/api/v1/sales-ledger/${query ? `?${query}` : ""}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error loading sales ledger");
        return response.json();
    },

    async createManualRecord(payload: SalesLedgerManualRecordInput): Promise<SalesLedgerEntry> {
        const response = await apiFetch("/api/v1/sales-ledger/manual-records", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "Error creating historical record");
        return response.json();
    },

    async updateManualRecord(recordId: number, payload: SalesLedgerManualRecordInput): Promise<SalesLedgerEntry> {
        const response = await apiFetch(`/api/v1/sales-ledger/manual-records/${recordId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "Error updating historical record");
        return response.json();
    },

    async deleteManualRecord(recordId: number): Promise<void> {
        const response = await apiFetch(`/api/v1/sales-ledger/manual-records/${recordId}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "Error deleting historical record");
    },

    async previewImport(file: File): Promise<SalesLedgerCsvPreview> {
        const response = await uploadCsv("/api/v1/sales-ledger/manual-records/import/preview", file);
        await assertApiResponseOk(response, "Error validating CSV file");
        return response.json();
    },

    async importCsv(file: File): Promise<{ created_count: number }> {
        const response = await uploadCsv("/api/v1/sales-ledger/manual-records/import", file);
        await assertApiResponseOk(response, "Error importing CSV file");
        return response.json();
    },
};
