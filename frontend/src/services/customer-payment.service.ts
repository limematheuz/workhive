import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api";
import type { InvoicePaymentMethod } from "@/types/invoice";

export type CustomerPaymentStatus = "received" | "voided";

export interface CustomerPaymentAllocation {
    id: number;
    invoice_id: number;
    amount: string;
    created_at: string;
}

export interface CustomerPayment {
    id: number;
    client_id: number;
    received_at: string;
    amount: string;
    payment_method: InvoicePaymentMethod | null;
    reference: string | null;
    notes: string | null;
    status: CustomerPaymentStatus;
    voided_at: string | null;
    void_reason: string | null;
    allocations: CustomerPaymentAllocation[];
    allocated_amount: string;
    unapplied_amount: string;
}

export interface CustomerPaymentCreate {
    client_id: number;
    received_at: string;
    amount: string;
    payment_method?: InvoicePaymentMethod | null;
    reference?: string | null;
    notes?: string | null;
    allocations: Array<{ invoice_id: number; amount: string }>;
}

export const CustomerPaymentService = {
    async getPayments(clientId?: number): Promise<CustomerPayment[]> {
        const suffix = clientId ? `?client_id=${clientId}` : "";
        const response = await apiFetch(`/api/v1/customer-payments/${suffix}`, {
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los cobros");
        return response.json();
    },

    async createPayment(payload: CustomerPaymentCreate): Promise<CustomerPayment> {
        const response = await apiFetch("/api/v1/customer-payments/", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo registrar el cobro"));
        }
        return response.json();
    },

    async voidPayment(paymentId: number, reason: string): Promise<CustomerPayment> {
        const response = await apiFetch(`/api/v1/customer-payments/${paymentId}/void`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
        await assertApiResponseOk(response, "No se pudo anular el cobro");
        return response.json();
    },
};
