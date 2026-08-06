import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api"
import { Invoice, InvoiceItem } from "@/types/invoice"
import { TaskItem } from "@/types/user"
import { collectPaginated } from "@/lib/pagination"

export interface InvoiceCreate {
    client_id: number;
    issue_date: string;
    due_date?: string | null;
    invoice_number?: string;
    discount?: number;
    equivalence_surcharge?: number;
    retention?: number;
    notes?: string | null;
    terms?: string | null;
    shipping_address?: string | null;
    custom_issuer_info?: string | null;
    custom_recipient_info?: string | null;
    signature_url?: string | null;
}

export interface InvoiceDraftCreate extends InvoiceCreate {
    items: InvoiceItemCreate[];
}

export interface InvoiceUpdate {
    client_id?: number;
    issue_date?: string;
    due_date?: string | null;
    invoice_number?: string;
    status?: string;
    discount?: number;
    equivalence_surcharge?: number;
    retention?: number;
    notes?: string | null;
    terms?: string | null;
    shipping_address?: string | null;
    custom_issuer_info?: string | null;
    custom_recipient_info?: string | null;
    signature_url?: string | null;
    items?: InvoiceItemCreate[];
}

export interface InvoiceItemCreate {
    description: string;
    quantity?: number;
    unit_price: number;
    tax_rate?: number;
    task_item_id?: number | null;
}

export interface InvoiceItemUpdate {
    description?: string;
    quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    task_item_id?: number | null;
}

export type InvoiceableTask = TaskItem & {
    client_id: number;
    client_name: string;
    location_name: string;
    billing_source: "own" | "external";
    collaborator_company_id?: number | null;
    collaborator_company_name?: string | null;
};

export interface RectificationCreate {
    reason: string;
    reason_code: string;
    issue_date: string;
    due_date?: string | null;
    notes?: string | null;
}

export interface FiscalReadiness {
    enabled: boolean;
    environment: "test" | "production";
    certificate_configured: boolean;
    submission_available: boolean;
}

export interface FiscalInvoiceRecord {
    id: number;
    invoice_id: number;
    record_type: "alta" | "anulacion";
    submission_status: string;
    aeat_csv?: string | null;
    error_message?: string | null;
    attempt_count: number;
    last_attempt_at?: string | null;
    next_retry_at?: string | null;
    generated_at: string;
    submitted_at?: string | null;
}

export interface FacturaeReadiness {
    schema_version: string;
    schema_available: boolean;
    certificate_configured: boolean;
    unsigned_generation_available: boolean;
    signed_generation_available: boolean;
    missing_fields: string[];
}

export interface InvoiceEmailPayload {
    recipient_email?: string;
    recipient_emails?: string[];
    copy_emails?: string[];
    subject?: string;
    message?: string;
    send_copy?: boolean;
    save_recipients?: boolean;
    save_recipient_to_client_id?: number;
    locale?: "en" | "es";
}

export const InvoiceService = {
    getInvoices: async (filters: {
        clientId?: number;
        status?: string;
        skip?: number;
        limit?: number;
    } = {}): Promise<Invoice[]> => {
        const queryParams = new URLSearchParams()
        if (filters.clientId) queryParams.set("client_id", filters.clientId.toString())
        if (filters.status) queryParams.set("invoice_status", filters.status)
        if (filters.skip) queryParams.set("skip", filters.skip.toString())
        if (filters.limit) queryParams.set("limit", filters.limit.toString())

        const response = await apiFetch(`/api/v1/invoices/?${queryParams.toString()}`, {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching invoices")
        return await response.json()
    },

    getAllInvoices: async (): Promise<Invoice[]> => collectPaginated(
        (skip, limit) => InvoiceService.getInvoices({ skip, limit }),
    ),

    getCompletedJobs: async (): Promise<InvoiceableTask[]> => {
        const response = await apiFetch("/api/v1/invoices/completed-jobs", {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching completed jobs")
        return await response.json()
    },

    getInvoice: async (id: number): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching invoice details")
        return await response.json()
    },

    createInvoice: async (data: InvoiceCreate): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error creating invoice")
        }
        return await response.json()
    },

    createInvoiceDraft: async (data: InvoiceDraftCreate): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/drafts`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error creating invoice draft")
        }
        return await response.json()
    },

    issueInvoice: async (id: number): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/issue`, {
            method: "POST"
        })
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error issuing invoice"))
        }
        return await response.json()
    },

    downloadInvoicePdf: async (id: number, invoiceNumber: string): Promise<void> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/pdf`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error downloading invoice PDF")
        }
        const objectUrl = URL.createObjectURL(await response.blob())
        const link = document.createElement("a")
        link.href = objectUrl
        link.download = `${invoiceNumber}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
    },

    sendInvoiceEmail: async (id: number, data: InvoiceEmailPayload): Promise<{ status: string; recipient_email: string }> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/send-email`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error sending invoice email"))
        }
        return await response.json()
    },

    getFiscalReadiness: async (): Promise<FiscalReadiness> => {
        const response = await apiFetch(`/api/v1/invoices/fiscal/readiness`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error loading fiscal integration status")
        }
        return await response.json()
    },

    getFiscalRecord: async (id: number): Promise<FiscalInvoiceRecord | null> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/fiscal-record`, {
            method: "GET",
            cache: "no-store"
        })
        if (response.status === 404) return null
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error loading fiscal record")
        }
        return await response.json()
    },

    submitFiscalRecord: async (id: number): Promise<FiscalInvoiceRecord> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/fiscal-record/submit`, {
            method: "POST"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error submitting invoice to AEAT")
        }
        return await response.json()
    },

    getFacturaeReadiness: async (id: number): Promise<FacturaeReadiness> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/facturae/readiness`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error loading Facturae status")
        }
        return await response.json()
    },

    generateFacturae: async (
        id: number,
        sign: boolean
    ): Promise<{ status: string; sha256: string; filename: string }> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/facturae`, {
            method: "POST",
            body: JSON.stringify({ sign })
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error generating Facturae")
        }
        return await response.json()
    },

    downloadFacturae: async (id: number, filename: string): Promise<void> => {
        const response = await apiFetch(`/api/v1/invoices/${id}/facturae`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error downloading Facturae")
        }
        const objectUrl = URL.createObjectURL(await response.blob())
        const link = document.createElement("a")
        link.href = objectUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
    },

    updateInvoice: async (id: number, data: InvoiceUpdate): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error updating invoice")
        }
        return await response.json()
    },

    getInvoiceItems: async (invoiceId: number): Promise<InvoiceItem[]> => {
        const response = await apiFetch(`/api/v1/invoices/${invoiceId}/items`, {
            method: "GET",
            cache: "no-store"
        })
        await assertApiResponseOk(response, "Error fetching invoice items")
        return await response.json()
    },

    createInvoiceItem: async (invoiceId: number, data: InvoiceItemCreate): Promise<InvoiceItem> => {
        const response = await apiFetch(`/api/v1/invoices/${invoiceId}/items`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error creating invoice item")
        }
        return await response.json()
    },

    updateInvoiceItem: async (invoiceId: number, itemId: number, data: InvoiceItemUpdate): Promise<InvoiceItem> => {
        const response = await apiFetch(`/api/v1/invoices/${invoiceId}/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error updating invoice item")
        }
        return await response.json()
    },

    deleteInvoiceItem: async (invoiceId: number, itemId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/invoices/${invoiceId}/items/${itemId}`, {
            method: "DELETE"
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error deleting invoice item")
        }
    },

    rectifyInvoice: async (invoiceId: number, data: RectificationCreate): Promise<Invoice> => {
        const response = await apiFetch(`/api/v1/invoices/${invoiceId}/rectify`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error creating rectification invoice")
        }
        return await response.json()
    }
}
