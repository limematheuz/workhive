export const STANDARD_TAX_RATES = [0.21, 0.1, 0.04, 0] as const;

export interface BillingLineInput {
    quantity: number;
    unitPrice: number;
    taxRate?: number;
}

export interface BillingTotals {
    subtotal: number;
    discountAmount: number;
    baseAmount: number;
    taxAmount: number;
    surchargeAmount: number;
    retentionAmount: number;
    totalAmount: number;
}

export function normalizeTaxRate(rate: number | null | undefined): number {
    if (rate == null || Number.isNaN(rate)) {
        return 0.21;
    }

    for (const standard of STANDARD_TAX_RATES) {
        if (Math.abs(rate - standard) < 0.001) {
            return standard;
        }
    }

    return Math.round(rate * 1000) / 1000;
}

export function taxRateToOptionValue(rate: number | null | undefined): string {
    const normalized = normalizeTaxRate(rate);
    if (normalized === 0.1) return "0.10";
    if (normalized === 0.04) return "0.04";
    if (normalized === 0) return "0";
    return "0.21";
}

export function parseTaxRateOptionValue(value: string): number {
    return normalizeTaxRate(parseFloat(value));
}

export function percentToOptionValue(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "0";
    const rounded = Math.round(value * 10) / 10;
    return rounded.toString();
}

export function parsePercentOptionValue(value: string): number {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function calculatePerLineTaxTotals(
    lines: BillingLineInput[],
    discountPercent = 0,
    equivalenceSurchargePercent = 0,
    retentionPercent = 0,
): BillingTotals {
    const subtotal = lines.reduce(
        (acc, line) => acc + line.quantity * line.unitPrice,
        0,
    );
    const discountAmount = subtotal * (discountPercent / 100);
    const baseAmount = subtotal - discountAmount;

    const taxAmount = lines.reduce((acc, line) => {
        const lineSubtotal = line.quantity * line.unitPrice;
        const lineBase = lineSubtotal * (1 - discountPercent / 100);
        return acc + lineBase * normalizeTaxRate(line.taxRate);
    }, 0);

    const surchargeAmount = baseAmount * (equivalenceSurchargePercent / 100);
    const retentionAmount = baseAmount * (retentionPercent / 100);

    return {
        subtotal,
        discountAmount,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalAmount: baseAmount + taxAmount + surchargeAmount - retentionAmount,
    };
}

export function calculateDocumentTaxTotals(
    lines: BillingLineInput[],
    taxRate: number,
    discountPercent = 0,
    equivalenceSurchargePercent = 0,
    retentionPercent = 0,
): BillingTotals {
    const subtotal = lines.reduce(
        (acc, line) => acc + line.quantity * line.unitPrice,
        0,
    );
    const discountAmount = subtotal * (discountPercent / 100);
    const baseAmount = subtotal - discountAmount;
    const normalizedTaxRate = normalizeTaxRate(taxRate);
    const taxAmount = baseAmount * normalizedTaxRate;
    const surchargeAmount = baseAmount * (equivalenceSurchargePercent / 100);
    const retentionAmount = baseAmount * (retentionPercent / 100);

    return {
        subtotal,
        discountAmount,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalAmount: baseAmount + taxAmount + surchargeAmount - retentionAmount,
    };
}

export function splitStoredTaxAmount(
    taxAmount: number,
    baseAmount: number,
    equivalenceSurchargePercent = 0,
) {
    const surchargeAmount = baseAmount * (equivalenceSurchargePercent / 100);
    const pureVatAmount = taxAmount - surchargeAmount;
    return { pureVatAmount, surchargeAmount };
}
