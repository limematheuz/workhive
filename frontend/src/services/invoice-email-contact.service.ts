import { apiFetch, extractErrorMessage } from "@/lib/api";

export interface InvoiceEmailContact {
    id: number;
    company_id: number;
    name?: string | null;
    email: string;
    source: string;
    use_count: number;
    last_used_at?: string | null;
    created_at: string;
    updated_at: string;
}

export const InvoiceEmailContactService = {
    getContacts: async (query = "", limit = 100): Promise<InvoiceEmailContact[]> => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (query.trim()) params.set("q", query.trim());
        const response = await apiFetch(`/api/v1/invoice-email-contacts/?${params}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching email contacts"));
        }
        return await response.json();
    },
};
