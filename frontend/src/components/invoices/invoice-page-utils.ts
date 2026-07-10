import type { InvoiceableTask } from "@/components/invoices/InvoiceableJobsSection";
import { getInvoiceStatusText } from "@/components/invoices/invoice-status-utils";
import { formatInvoiceNumber } from "@/lib/format";
import type { Client } from "@/services/client.service";
import type { Invoice } from "@/types/invoice";

type JobFilters = {
    partyFilter: string;
    invoiceFilter: "all" | "pending" | "invoiced";
    search: string;
    dateFrom: string;
    dateTo: string;
};

export const mergeClientsIfChanged = (prev: Client[], next: Client[]) => {
    if (
        prev.length === next.length
        && prev.every(
            (client, index) =>
                client.id === next[index]?.id
                && client.name === next[index]?.name
        )
    ) {
        return prev;
    }
    return next;
};

export const mergeInvoiceableTasksIfChanged = (prev: InvoiceableTask[], next: InvoiceableTask[]) => {
    if (
        prev.length === next.length
        && prev.every(
            (task, index) =>
                task.id === next[index]?.id
                && task.is_invoiced === next[index]?.is_invoiced
        )
    ) {
        return prev;
    }
    return next;
};

export const mapCompletedJobsToTasks = (
    jobs: Awaited<ReturnType<typeof import("@/services/invoice.service").InvoiceService.getCompletedJobs>>
): InvoiceableTask[] =>
    jobs.map((task) => ({
        ...task,
        clientId: task.client_id,
        clientName: task.client_name,
        locationName: task.location_name,
    })).sort((a, b) => {
        const aDate = new Date(a.date_done || a.created_at).getTime();
        const bDate = new Date(b.date_done || b.created_at).getTime();
        return bDate - aDate;
    });

export const filterInvoiceableTasks = (tasks: InvoiceableTask[], filters: JobFilters) =>
    tasks.filter((task) => {
        const text = `${task.title} ${task.clientName} ${task.locationName}`.toLowerCase();
        const date = new Date(task.date_done || task.created_at);
        const matchesParty =
            !filters.partyFilter
            || filters.partyFilter === `client:${task.clientId}`
            || (
                task.collaborator_company_id
                && filters.partyFilter === `collaborator:${task.collaborator_company_id}`
            );
        const matchesInvoiceState =
            filters.invoiceFilter === "all"
            || (filters.invoiceFilter === "pending" && !task.is_invoiced)
            || (filters.invoiceFilter === "invoiced" && task.is_invoiced);
        const matchesSearch = !filters.search.trim() || text.includes(filters.search.toLowerCase().trim());
        const matchesFrom = !filters.dateFrom || date >= new Date(`${filters.dateFrom}T00:00:00`);
        const matchesTo = !filters.dateTo || date <= new Date(`${filters.dateTo}T23:59:59`);

        return matchesParty && matchesInvoiceState && matchesSearch && matchesFrom && matchesTo;
    });

export const getCollaboratorOptions = (tasks: InvoiceableTask[]) =>
    Array.from(
        new Map(
            tasks.flatMap((task) =>
                task.collaborator_company_id && task.collaborator_company_name
                    ? [[
                        task.collaborator_company_id as number,
                        task.collaborator_company_name as string,
                    ] as const]
                    : []
            )
        )
    );

export const filterVisibleInvoices = (
    invoices: Invoice[],
    search: string,
    getClientName: (clientId: number) => string,
    statusLabels: Parameters<typeof getInvoiceStatusText>[1]
) => {
    const query = search.trim().toLowerCase();
    if (!query) return invoices;

    return invoices.filter((invoice) => {
        const searchable = [
            formatInvoiceNumber(invoice.invoice_number),
            getClientName(invoice.client_id),
            getInvoiceStatusText(invoice.status, statusLabels),
        ].join(" ").toLowerCase();

        return searchable.includes(query);
    });
};

export const computeInvoiceStats = (invoices: Invoice[]) => ({
    totalCount: invoices.length,
    totalAmount: invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0),
    paidAmount: invoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + invoice.total_amount, 0),
    openAmount: invoices
        .filter((invoice) => ["draft", "issued", "overdue"].includes(invoice.status))
        .reduce((sum, invoice) => sum + invoice.total_amount, 0),
    overdueAmount: invoices
        .filter((invoice) => invoice.status === "overdue")
        .reduce((sum, invoice) => sum + invoice.total_amount, 0),
});

export const computeStatusCounts = (invoices: Invoice[]) =>
    invoices.reduce<Record<string, number>>((acc, invoice) => {
        acc[invoice.status] = (acc[invoice.status] || 0) + 1;
        return acc;
    }, {});

export const isInvoicesAdmin = (roleName?: string | null) =>
    roleName === "admin" || roleName === "superadmin";
