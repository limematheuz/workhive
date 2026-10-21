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

export type SalesLedgerCollectionState = "paid" | "partial" | "pending" | "rectified" | "credit_note";

export function getSalesLedgerCollectionState(entry: SalesLedgerEntry): SalesLedgerCollectionState {
    if (entry.source_type === "invoice") {
        if (entry.is_rectification) return "credit_note";
        if (entry.invoice_status === "rectified") return "rectified";
        if (entry.invoice_status === "paid") return "paid";
        if ((entry.collected_amount ?? 0) > 0) return "partial";
    }
    return entry.payment_status === "paid" ? "paid" : "pending";
}

const CSV_COLLECTION_LABELS: Record<SalesLedgerCollectionState, string> = {
    paid: "Pagada",
    partial: "Parcialmente cobrada",
    pending: "Pendiente",
    rectified: "Rectificada",
    credit_note: "Rectificativa",
};

function csvCell(value: string | number): string {
    const raw = String(value);
    const text = typeof value === "string" && /^[=+@-]/.test(raw) && !/^-\d+,\d{2}$/.test(raw) ? `'${raw}` : raw;
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
        if (entry.source_type === "invoice" && typeof entry.collected_amount === "number") {
            totals.paid += entry.collected_amount;
            if (!entry.is_rectification && ["issued", "partially_paid", "overdue"].includes(entry.invoice_status ?? "")) {
                totals.pending += Math.max(0, entry.total_amount - entry.collected_amount);
            }
        } else if (entry.payment_status === "paid") totals.paid += entry.total_amount;
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
            CSV_COLLECTION_LABELS[getSalesLedgerCollectionState(entry)],
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
