import type { SalesLedgerEntry } from "@/services/sales-ledger.service";

export const SALES_LEDGER_CSV_HEADERS = [
    "N Factura",
    "Fecha",
    "Cliente",
    "Importe Total",
    "Base",
    "IVA",
    "Cobrada",
] as const;

export const SALES_LEDGER_CSV_TEMPLATE = [
    SALES_LEDGER_CSV_HEADERS.join(";"),
    "FV/2025/0001;05/01/2025;Nombre del cliente;121,00;100,00;21,00;Pagada",
].join("\n");

export type SalesLedgerTotals = {
    base: number;
    tax: number;
    total: number;
    paid: number;
    pending: number;
};

function csvCell(value: string | number): string {
    const raw = String(value);
    const text = typeof value === "string" && /^[=+@-]/.test(raw) ? `'${raw}` : raw;
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function moneyForCsv(value: number): string {
    return value.toFixed(2).replace(".", ",");
}

export function getSalesLedgerYears(entries: SalesLedgerEntry[]): string[] {
    return Array.from(new Set(entries.flatMap((entry) => {
        const year = entry.entry_date.substring(0, 4);
        return year ? [year] : [];
    })))
        .sort((first, second) => Number(second) - Number(first));
}

export function filterSalesLedgerEntries(
    entries: SalesLedgerEntry[],
    filters: { year: string; search: string },
): SalesLedgerEntry[] {
    const search = filters.search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
        if (filters.year && entry.entry_date.substring(0, 4) !== filters.year) return false;
        if (!search) return true;
        return `${entry.document_number} ${entry.client_name}`.toLocaleLowerCase().includes(search);
    });
}

export function summarizeSalesLedger(entries: SalesLedgerEntry[]): SalesLedgerTotals {
    return entries.reduce<SalesLedgerTotals>((totals, entry) => {
        totals.base += entry.base_amount;
        totals.tax += entry.tax_amount;
        totals.total += entry.total_amount;
        if (entry.payment_status === "paid") totals.paid += entry.total_amount;
        else totals.pending += entry.total_amount;
        return totals;
    }, { base: 0, tax: 0, total: 0, paid: 0, pending: 0 });
}

export function buildSalesLedgerCsv(entries: SalesLedgerEntry[]): string {
    return [
        SALES_LEDGER_CSV_HEADERS.join(";"),
        ...entries.map((entry) => [
            entry.document_number,
            entry.entry_date.substring(0, 10).split("-").reverse().join("/"),
            entry.client_name,
            moneyForCsv(entry.total_amount),
            moneyForCsv(entry.base_amount),
            moneyForCsv(entry.tax_amount),
            entry.payment_status === "paid" ? "Pagada" : "Pendiente",
        ].map(csvCell).join(";")),
    ].join("\n");
}

export function parseMoneyInput(value: string): number | null {
    const compact = value.trim().replace(/\s/g, "");
    if (!compact) return null;
    if (!/^\d[\d.,]*$/.test(compact)) return null;

    const separators = compact.match(/[.,]/g) ?? [];
    const hasOnlyOneSeparatorType = new Set(separators).size <= 1;
    if (hasOnlyOneSeparatorType && /^\d{1,3}([.,]\d{3})+$/.test(compact)) {
        return Number(compact.replace(/[.,]/g, ""));
    }

    const lastComma = compact.lastIndexOf(",");
    const lastPeriod = compact.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastPeriod);
    if (decimalIndex >= 0 && !/^\d{1,2}$/.test(compact.slice(decimalIndex + 1))) return null;
    const normalized = decimalIndex >= 0
        ? `${compact.slice(0, decimalIndex).replace(/[.,]/g, "")}.${compact.slice(decimalIndex + 1)}`
        : compact;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
