import { apiFetch, assertApiResponseOk } from "@/lib/api"
import type { QuoteClientRegistrationInput } from "@/lib/quote-client-registration"
import { Quote, QuoteItem, QuoteRevision } from "@/types/quote"

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
    items?: QuoteItemCreate[];
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
    items?: QuoteItemCreate[];
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

export interface QuoteAcceptRequest {
    register_client: boolean;
    client?: QuoteClientRegistrationInput;
}

export interface QuoteEmailPayload {
    recipient_email?: string;
    recipient_emails?: string[];
    copy_emails?: string[];
    subject?: string;
    message?: string;
    send_copy?: boolean;
    save_recipients?: boolean;
    save_recipient_to_client_id?: number;
    locale?: "es" | "en";
}

export const QuoteService = {
    getQuotes: async (filters: {
        clientId?: number;
        status?: string;
        skip?: number;
        limit?: number;
    } = {}, readContext?: string): Promise<Quote[]> => {
        const params = new URLSearchParams()
        if (filters.clientId) params.set("client_id", filters.clientId.toString())
        if (filters.status) params.set("quote_status", filters.status)
        if (filters.skip) params.set("skip", filters.skip.toString())
        if (filters.limit) params.set("limit", filters.limit.toString())

        const response = await apiFetch(`/api/v1/quotes/?${params.toString()}`, {
            method: "GET",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudieron cargar los presupuestos")
        return await response.json()
    },

    getQuote: async (id: number, readContext?: string): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "GET",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudo cargar el presupuesto")
        return await response.json()
    },

    downloadQuotePdf: async (id: number): Promise<Blob> => {
        const response = await apiFetch(`/api/v1/quotes/${id}/pdf`, {
            method: "GET",
        })
        await assertApiResponseOk(response, "No se pudo descargar el PDF del presupuesto")
        return await response.blob()
    },

    createQuote: async (data: QuoteCreate): Promise<Quote> => {
        const response = await apiFetch("/api/v1/quotes/", {
            method: "POST",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo crear el presupuesto")
        return await response.json()
    },

    updateQuote: async (id: number, data: QuoteUpdate): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo actualizar el presupuesto")
        return await response.json()
    },

    acceptQuote: async (id: number, data: QuoteAcceptRequest): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}/accept`, {
            method: "POST",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo aceptar el presupuesto")
        return await response.json()
    },

    getQuoteRevisions: async (id: number): Promise<QuoteRevision[]> => {
        const response = await apiFetch(`/api/v1/quotes/${id}/revisions`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudo cargar el historial de versiones")
        return await response.json()
    },

    createQuoteRevision: async (id: number): Promise<Quote> => {
        const response = await apiFetch(`/api/v1/quotes/${id}/revisions`, {
            method: "POST",
            body: JSON.stringify({}),
        })
        await assertApiResponseOk(response, "No se pudo crear la revisión")
        return await response.json()
    },

    sendQuoteEmail: async (
        id: number,
        data: QuoteEmailPayload,
    ): Promise<{ status: string; recipient_email: string }> => {
        const response = await apiFetch(`/api/v1/quotes/${id}/send-email`, {
            method: "POST",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo enviar el presupuesto por email")
        return await response.json()
    },

    deleteQuote: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/quotes/${id}`, {
            method: "DELETE",
        })
        await assertApiResponseOk(response, "No se pudo eliminar el presupuesto")
    },

    // Items
    createQuoteItem: async (quoteId: number, data: QuoteItemCreate): Promise<QuoteItem> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items`, {
            method: "POST",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo añadir el concepto")
        return await response.json()
    },

    updateQuoteItem: async (quoteId: number, itemId: number, data: QuoteItemUpdate): Promise<QuoteItem> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        })
        await assertApiResponseOk(response, "No se pudo actualizar el concepto")
        return await response.json()
    },

    deleteQuoteItem: async (quoteId: number, itemId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/quotes/${quoteId}/items/${itemId}`, {
            method: "DELETE",
        })
        await assertApiResponseOk(response, "No se pudo eliminar el concepto")
    },
}
