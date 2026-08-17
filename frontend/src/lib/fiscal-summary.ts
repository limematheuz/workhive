import type { FiscalPeriodSummary } from "@/services/fiscal-summary.service";

export type FiscalVatBalanceState = "payable" | "credit" | "balanced";

export function getFiscalVatBalanceState(balance: number): FiscalVatBalanceState {
    if (balance > 0) return "payable";
    if (balance < 0) return "credit";
    return "balanced";
}

export function getFiscalSummaryYearOptions(selectedYear: number, currentYear: number): number[] {
    return Array.from(new Set([selectedYear, currentYear, currentYear - 1, currentYear - 2]))
        .filter((year) => year >= 2000)
        .sort((left, right) => right - left);
}

export function getFiscalPeriodActivityLabel(period: FiscalPeriodSummary): string {
    return `${period.issued_invoice_count}/${period.registered_expense_count}`;
}
