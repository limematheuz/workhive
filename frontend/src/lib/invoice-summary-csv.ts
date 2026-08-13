import type { Invoice } from "@/types/invoice";

export const INVOICE_SUMMARY_CSV_HEADERS = [
    "N Factura",
    "Fecha",
    "Cliente",
    "Importe Total",
    "Base",
    "IVA",
    "Cobrada",
] as const;

export const INVOICE_SUMMARY_CSV_TEMPLATE = [
    INVOICE_SUMMARY_CSV_HEADERS.join(";"),
    "FV/2026/0001;05/01/2026;Nombre del cliente;121,00;100,00;21,00;Pagada",
].join("\n");

function csvCell(value: string | number): string {
    const text = String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildInvoiceSummaryCsv(
    invoices: Array<{ invoice: Invoice; clientName: string }>,
): string {
    return [
        INVOICE_SUMMARY_CSV_HEADERS.join(";"),
        ...invoices.map(({ invoice, clientName }) => [
            invoice.invoice_number,
            invoice.issue_date.substring(0, 10),
            clientName,
            invoice.total_amount.toFixed(2).replace(".", ","),
            invoice.base_amount.toFixed(2).replace(".", ","),
            invoice.tax_amount.toFixed(2).replace(".", ","),
            invoice.status === "paid" ? "Pagada" : "Pendiente",
        ].map(csvCell).join(";")),
    ].join("\n");
}
