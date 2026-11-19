import { InvoiceService, type InvoiceableTask } from "@/services/invoice.service";
import { QuoteService } from "@/services/quote.service";
import { collectPaginated } from "@/lib/pagination";
import type { Invoice } from "@/types/invoice";
import type { Quote } from "@/types/quote";

const timestamp = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" });
export type FinancePrioritiesSnapshot = { invoices: Invoice[]; jobs: InvoiceableTask[]; quotes: Quote[]; asOf: string; asOfLabel: string };
export const FinancePrioritiesService = {
    async read({ invoices, quotes }: { invoices: boolean; quotes: boolean }): Promise<FinancePrioritiesSnapshot> {
        const [invoiceRows, jobs, quoteRows] = await Promise.all([
            invoices ? InvoiceService.getAllInvoices() : Promise.resolve([]),
            invoices ? InvoiceService.getCompletedJobs() : Promise.resolve([]),
            quotes ? collectPaginated((skip, limit) => QuoteService.getQuotes({ status: "sent", skip, limit })) : Promise.resolve([]),
        ]);
        const now = new Date();
        return { invoices: invoiceRows, jobs, quotes: quoteRows.filter(row => row.status === "sent"), asOf: now.toISOString(), asOfLabel: timestamp.format(now) };
    },
};
