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

export function roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function priceExcludingTax(priceIncludingTax: number, taxRate: number): number {
    const rate = normalizeTaxRate(taxRate);
    return rate === 0 ? priceIncludingTax : roundCurrency(priceIncludingTax / (1 + rate));
}

export function priceIncludingTax(priceExcludingTax: number, taxRate: number): number {
    return roundCurrency(priceExcludingTax * (1 + normalizeTaxRate(taxRate)));
}

export function priceForTaxMode(
    price: number,
    taxRate: number,
    fromIncludesTax: boolean,
    toIncludesTax: boolean,
): number {
    if (fromIncludesTax === toIncludesTax) return price;
    return toIncludesTax
        ? priceIncludingTax(price, taxRate)
        : priceExcludingTax(price, taxRate);
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
    pricesIncludeTax = false,
): BillingTotals {
    const taxExclusiveLines = pricesIncludeTax
        ? lines.map((line) => ({
            ...line,
            unitPrice: priceExcludingTax(line.unitPrice, line.taxRate || 0),
        }))
        : lines;
    const subtotal = lines.reduce(
        (acc, line) => acc + line.quantity * line.unitPrice,
        0,
    );
    const taxableSubtotal = taxExclusiveLines.reduce(
        (acc, line) => acc + line.quantity * line.unitPrice,
        0,
    );
    const discountAmount = taxableSubtotal * (discountPercent / 100);
    const baseAmount = taxableSubtotal - discountAmount;

    const taxAmount = taxExclusiveLines.reduce((acc, line) => {
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
    pricesIncludeTax = false,
): BillingTotals {
    const subtotal = lines.reduce(
        (acc, line) => acc + line.quantity * line.unitPrice,
        0,
    );
    const normalizedTaxRate = normalizeTaxRate(taxRate);
    const taxableSubtotal = pricesIncludeTax
        ? lines.reduce(
            (acc, line) => acc + line.quantity * priceExcludingTax(line.unitPrice, normalizedTaxRate),
            0,
        )
        : subtotal;
    const discountAmount = taxableSubtotal * (discountPercent / 100);
    const baseAmount = taxableSubtotal - discountAmount;
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
