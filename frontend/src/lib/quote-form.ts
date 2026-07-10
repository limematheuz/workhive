import type { BillingPartyFields } from "@/components/billing/BillingPartyCard";
import type { Client } from "@/services/client.service";
import type { Company } from "@/services/company.service";
import type { QuoteCreate } from "@/services/quote.service";
import type { Quote, QuoteItem } from "@/types/quote";

export const DEFAULT_QUOTE_TAX_RATE = 0.21;

export interface QuoteFormConceptRow {
    id: string;
    description: string;
    unitPrice: number;
    quantity: number;
    taxRate: number;
}

export interface QuoteItemChanges {
    deletedItems: QuoteItem[];
    updatedItems: QuoteFormConceptRow[];
    newItems: QuoteFormConceptRow[];
}

export function createQuoteConceptRow(
    taxRate: number = DEFAULT_QUOTE_TAX_RATE,
    id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
): QuoteFormConceptRow {
    return {
        id,
        description: "",
        unitPrice: 0,
        quantity: 1,
        taxRate,
    };
}

export function formatQuoteValidUntilDate(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function getQuoteIssuerFieldsFromCompany(company: Company): BillingPartyFields {
    return {
        name: company.name || "",
        taxId: company.tax_id || "",
        address: company.address || "",
        phone: company.phone || "",
        email: company.email || "",
        bank: company.bank_account || "",
    };
}

export function getQuoteRecipientFieldsFromClient(client: Client): BillingPartyFields {
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

export function mapQuoteItemsToConceptRows(
    quote: Quote,
    fallbackTaxRate: number = DEFAULT_QUOTE_TAX_RATE,
): QuoteFormConceptRow[] {
    if (!quote.items?.length) return [createQuoteConceptRow(fallbackTaxRate)];
    const taxRate = quote.tax_rate || fallbackTaxRate;
    return quote.items.map(item => ({
        id: item.id.toString(),
        description: item.description,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        taxRate,
    }));
}

export function buildQuotePayload(params: {
    selectedClientId: string;
    title: string;
    validUntil: string;
    notesEnabled: boolean;
    notes: string;
    taxRateGlobal: number;
    discount: number;
    equivalenceSurcharge: number;
    retention: number;
    termsEnabled: boolean;
    terms: string;
    shippingAddress: string;
    customIssuerInfo: string;
    customRecipientInfo: string;
    signatureUrl: string | null;
}): QuoteCreate {
    return {
        client_id: params.selectedClientId
            ? parseInt(params.selectedClientId, 10)
            : null,
        title: params.title,
        valid_until: params.validUntil
            ? new Date(params.validUntil).toISOString()
            : null,
        notes: params.notesEnabled ? params.notes : null,
        tax_rate: params.taxRateGlobal,
        discount: params.discount,
        equivalence_surcharge: params.equivalenceSurcharge,
        retention: params.retention,
        terms: params.termsEnabled ? params.terms : null,
        shipping_address: params.shippingAddress || null,
        custom_issuer_info: params.customIssuerInfo || null,
        custom_recipient_info: params.customRecipientInfo || null,
        signature_url: params.signatureUrl || null,
    };
}

export function getQuoteItemChanges(
    originalItems: QuoteItem[],
    concepts: QuoteFormConceptRow[],
): QuoteItemChanges {
    const deletedItems = originalItems.filter(
        original => !concepts.some(concept => concept.id === original.id.toString()),
    );
    const updatedItems = concepts.filter(
        concept =>
            !concept.id.startsWith("manual-")
            && originalItems.some(original => original.id.toString() === concept.id),
    );
    const newItems = concepts.filter(concept => concept.id.startsWith("manual-"));

    return { deletedItems, updatedItems, newItems };
}
