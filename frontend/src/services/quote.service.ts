import { apiFetch, assertApiResponseOk } from "@/lib/api"
import { Quote, QuoteItem } from "@/types/quote"

export interface QuoteCreate {
    client_id?: number | null;
    title: string;
    valid_until?: string | null;
    notes?: string | null;
    tax_rate?: number;
    discount?: number;
    equivalence_surcharge?: number;
    retention?: number;
    terms?: string | null;
    shipping_address?: string | null;
    custom_issuer_info?: string | null;
    custom_recipient_info?: string | null;
    signature_url?: string | null;
}

export interface QuoteUpdate {
    client_id?: number | null;
    title?: string;
    status?: string;
    valid_until?: string | null;
    notes?: string | null;
    tax_rate?: number;
    discount?: number;
    equivalence_surcharge?: number;
    retention?: number;
    terms?: string | null;
    shipping_address?: string | null;
    custom_issuer_info?: string | null;
    custom_recipient_info?: string | null;
    signature_url?: string | null;
}

export interface QuoteItemCreate {
    description: string;
    quantity: number;
    unit_price: number;
}

export interface QuoteItemUpdate {
    description?: string;
    quantity?: number;
    unit_price?: number;
}

export const QuoteService = {
    getQuotes: async (filters: {
        clientId?: number;
        status?: string;
        skip?: number;
        limit?: number;
    } = {}): Promise<Quote[]> => {
        const params = new URLSearchParams()
        if (filters.clientId) params.set("client_id", filters.clientId.toString())
        if (filters.status) params.set("quote_status", filters.status)
        if (filters.skip) params.set("skip", filters.skip.toString())
        if (filters.limit) params.set("limit", filters.limit.toString())

        const response = await apiFetch(`/api/v1/quotes/?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "Error fetching quotes")
        return await response.json()
    },

    getQuote: async (id: number): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "Error fetching quote")
        return await response.json()
    },

    createQuote: async (data: QuoteCreate): Promise<Quote> => {
        const response = await apiFetch("/api/v1/quotes/", {
            method: "POST",
            body: JSON.stringify(data),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error creating quote")
        }
        return await response.json()
    },

    updateQuote: async (id: number, data: QuoteUpdate): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error updating quote")
        }
        return await response.json()
    },

    deleteQuote: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "DELETE",
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error deleting quote")
        }
    },

    // Items
    createQuoteItem: async (quoteId: number, data: QuoteItemCreate): Promise<QuoteItem> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items`, {
            method: "POST",
            body: JSON.stringify(data),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error adding item")
        }
        return await response.json()
    },

    updateQuoteItem: async (quoteId: number, itemId: number, data: QuoteItemUpdate): Promise<QuoteItem> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error updating item")
        }
        return await response.json()
    },

    deleteQuoteItem: async (quoteId: number, itemId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items/${itemId}`, {
            method: "DELETE",
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || "Error deleting item")
        }
    },
}
