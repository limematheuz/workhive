export type CommercialTermsFormValue = {
    billing_interval: "monthly" | "annual";
    amount: string;
    currency: string;
    tax_behavior: "exclusive" | "inclusive";
    effective_at: string;
};

export type CommercialTermsPayload = {
    billing_interval: "monthly" | "annual";
    amount_cents: number;
    currency: string;
    tax_behavior: "exclusive" | "inclusive";
    effective_at: string;
};

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function emptyCommercialTerms(): CommercialTermsFormValue {
    return {
        billing_interval: "monthly",
        amount: "",
        currency: "EUR",
        tax_behavior: "exclusive",
        effective_at: today(),
    };
}

export function formatCommercialAmount(amountCents: number): string {
    const euros = Math.floor(amountCents / 100);
    const cents = Math.abs(amountCents % 100).toString().padStart(2, "0");
    return `${euros}.${cents}`;
}

export function commercialTermsFormValue(
    terms: CommercialTermsPayload | null | undefined,
): CommercialTermsFormValue {
    if (!terms) return emptyCommercialTerms();
    return {
        billing_interval: terms.billing_interval,
        amount: formatCommercialAmount(terms.amount_cents),
        currency: terms.currency,
        tax_behavior: terms.tax_behavior,
        effective_at: terms.effective_at.slice(0, 10),
    };
}

function eurosToCents(value: string): number | null {
    const normalized = value.trim().replace(",", ".");
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
    if (!match) return null;
    const euros = Number(match[1]);
    const cents = Number((match[2] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(euros) || !Number.isSafeInteger(cents)) return null;
    const amountCents = euros * 100 + cents;
    return Number.isSafeInteger(amountCents) ? amountCents : null;
}

export function commercialTermsPayload(
    value: CommercialTermsFormValue,
): CommercialTermsPayload | null {
    const amountCents = eurosToCents(value.amount);
    const currency = value.currency.trim().toUpperCase();
    if (
        amountCents === null
        || currency !== "EUR"
        || !value.effective_at
    ) {
        return null;
    }
    return {
        billing_interval: value.billing_interval,
        amount_cents: amountCents,
        currency,
        tax_behavior: value.tax_behavior,
        effective_at: `${value.effective_at}T00:00:00Z`,
    };
}
