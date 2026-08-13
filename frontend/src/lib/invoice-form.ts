import type { BillingPartyFields } from "@/components/billing/BillingPartyCard";
import type { Client } from "@/services/client.service";
import type { Company } from "@/services/company.service";
import type {
    InvoiceDraftCreate,
    InvoiceableTask,
} from "@/services/invoice.service";
import type { InvoicePaymentMethod } from "@/types/invoice";

export const DEFAULT_INVOICE_TAX_RATE = 0.21;
export const DEFAULT_INVOICE_DUE_DAYS = 15;

export interface InvoiceFormConceptRow {
    id: string;
    description: string;
    unitPrice: number;
    quantity: number;
    taxRate: number;
    task_item_id?: number | null;
    pricing_mode?: "fixed" | "hourly";
    worked_seconds?: number | null;
}

export function getTodayIsoDate(): string {
    return new Date().toISOString().substring(0, 10);
}

export function addDaysAsIsoDate(value: string | Date, days: number): string {
    const date = typeof value === "string" ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    return date.toISOString().substring(0, 10);
}

export function getDefaultInvoiceDueDate(issueDate: string | Date = new Date()): string {
    return addDaysAsIsoDate(issueDate, DEFAULT_INVOICE_DUE_DAYS);
}

export function resolveInvoiceClientId(params: {
    clients: Client[];
    initialTasks: InvoiceableTask[];
    initialClientId?: string;
}): string {
    const { clients, initialTasks, initialClientId } = params;
    const initialClientName = initialTasks[0]?.client_name?.trim().toLocaleLowerCase();
    const initialTaskClientId = initialTasks[0]?.client_id?.toString();
    const clientFromTaskName = initialClientName
        ? clients.find(client => client.name.trim().toLocaleLowerCase() === initialClientName)
        : undefined;
    const clientFromTaskId = initialTaskClientId
        ? clients.find(client => client.id.toString() === initialTaskClientId)
        : undefined;

    return (
        clientFromTaskName?.id
        ?? clientFromTaskId?.id
        ?? (initialClientId ? Number(initialClientId) : undefined)
        ?? ""
    ).toString();
}

export function forceInvoiceTasksClientId(
    tasks: InvoiceableTask[],
    clientId: string,
): InvoiceableTask[] {
    if (!clientId) return tasks;
    const numericClientId = Number(clientId);
    if (!Number.isFinite(numericClientId)) return tasks;
    return tasks.map(task => ({ ...task, client_id: numericClientId }));
}

export function getIssuerFieldsFromCompany(company: Company): BillingPartyFields {
    return {
        name: company.name || "",
        taxId: company.tax_id || "",
        address: company.address || "",
        phone: company.phone || "",
        email: company.email || "",
        bank: company.bank_account || "",
        swiftBic: company.swift_bic || "",
    };
}

export function getRecipientFieldsFromClient(client: Client): BillingPartyFields {
    const cityParts = [
        client.postal_code?.trim(),
        client.city?.trim(),
    ].filter(Boolean);
    const cityLine = [
        cityParts.join(" "),
        client.country?.trim(),
    ].filter(Boolean).join(", ");
    const addressLines = [
        client.address?.trim(),
        cityLine,
    ].filter(Boolean);

    return {
        name: client.name || "",
        taxId: client.legal_number || "",
        address: addressLines.join("\n"),
        phone: client.phone || "",
        email: client.email || "",
    };
}

export function createInvoiceConceptRow(
    taxRate: number,
    kind: "manual" | "external-laundry" = "manual",
): InvoiceFormConceptRow {
    return {
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: kind === "external-laundry"
            ? "Lavandería externa\nServicio subcontratado"
            : "",
        unitPrice: 0,
        quantity: 1,
        taxRate,
        task_item_id: null,
        pricing_mode: "fixed",
        worked_seconds: null,
    };
}

export function buildInvoiceDraftPayload(params: {
    selectedClientId: string;
    issueDate: string;
    dueDate: string;
    invoiceNumber: string;
    discount: number;
    equivalenceSurcharge: number;
    retention: number;
    paymentMethod: InvoicePaymentMethod;
    notesEnabled: boolean;
    notes: string;
    termsEnabled: boolean;
    terms: string;
    shippingAddress: string;
    customIssuerInfo: string;
    customRecipientInfo: string;
    signatureUrl: string | null;
    concepts: InvoiceFormConceptRow[];
}): InvoiceDraftCreate {
    return {
        client_id: parseInt(params.selectedClientId, 10),
        issue_date: new Date(params.issueDate).toISOString(),
        due_date: params.dueDate ? new Date(params.dueDate).toISOString() : null,
        invoice_number: params.invoiceNumber.trim() || undefined,
        discount: params.discount,
        equivalence_surcharge: params.equivalenceSurcharge,
        retention: params.retention,
        payment_method: params.paymentMethod,
        notes: params.notesEnabled ? params.notes : null,
        terms: params.termsEnabled ? params.terms : null,
        shipping_address: params.shippingAddress || null,
        custom_issuer_info: params.customIssuerInfo || null,
        custom_recipient_info: params.customRecipientInfo || null,
        signature_url: params.signatureUrl || null,
        items: params.concepts.map((concept) => ({
            description: concept.description || "Línea de concepto",
            quantity: concept.quantity,
            unit_price: concept.unitPrice,
            tax_rate: concept.taxRate,
            task_item_id: concept.task_item_id,
        })),
    };
}
