import { parseBillingInfo } from "./billing.ts";
import type { Quote } from "@/types/quote";

export interface QuoteClientRegistrationInput {
    name: string;
    client_type: "individual" | "business";
    legal_number: string | null;
    email: string | null;
    phone: string | null;
    address: string;
    city: string;
    province: string | null;
    postal_code: string;
    country: string;
}

export function createQuoteClientRegistrationDraft(
    quote: Quote,
): QuoteClientRegistrationInput {
    const recipient = parseBillingInfo(quote.custom_recipient_info || "");
    return {
        name: recipient.name || quote.title || "Nuevo cliente",
        client_type: recipient.taxId ? "business" : "individual",
        legal_number: recipient.taxId || null,
        email: recipient.email || null,
        phone: recipient.phone || null,
        address: recipient.address || "",
        city: "",
        province: null,
        postal_code: "",
        country: "España",
    };
}
