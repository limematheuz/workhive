import { collectPaginated } from "@/lib/pagination";
import { manualSalesLedgerEntriesWithoutWorkHiveInvoices, manualSalesLedgerToFinanceRevenue } from "@/lib/finance-analytics";
import { CustomerPaymentService } from "@/services/customer-payment.service";
import { ExpenseService } from "@/services/expense.service";
import { InvoiceService } from "@/services/invoice.service";
import { SalesLedgerService } from "@/services/sales-ledger.service";

export const FinanceOverviewService = {
    async getSnapshot({ includeInvoices }: { includeInvoices: boolean }) {
        const [invoices, expenses, ledger, payments] = await Promise.all([
            includeInvoices ? InvoiceService.getAllInvoices() : Promise.resolve([]),
            ExpenseService.getAllExpenses(),
            collectPaginated((skip, limit) => SalesLedgerService.getEntries({ skip, limit })),
            includeInvoices ? CustomerPaymentService.getPayments() : Promise.resolve([]),
        ]);
        return {
            revenue: [
                ...invoices,
                ...manualSalesLedgerEntriesWithoutWorkHiveInvoices(
                    ledger.filter(entry => entry.source_type === "manual"), invoices,
                ).map(manualSalesLedgerToFinanceRevenue),
            ],
            expenses,
            payments,
        };
    },
};
