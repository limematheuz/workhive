import type { Client } from "../types/client.ts";
import type { Invoice } from "../types/invoice.ts";
import type { Location } from "../types/location.ts";
import type { TaskItem } from "../types/user.ts";

export type ClientWorkspaceRow = {
    client: Client;
    locationCount: number;
    taskCount: number;
    pendingTaskCount: number;
    annualBillingTotal: number;
    pendingBalance: number;
    lastActivityAt: string | null;
    nextScheduledAt: string | null;
    hasContact: boolean;
};

export type ClientWorkspaceSummary = {
    clientCount: number;
    activeClientCount: number;
    missingContactCount: number;
    locationCount: number;
    pendingTaskCount: number;
    annualBillingTotal: number;
    pendingBalanceTotal: number;
    hasFinancialData: boolean;
};

export type ClientWorkspace = {
    rows: ClientWorkspaceRow[];
    summary: ClientWorkspaceSummary;
};

export type ClientWorkspaceMonthlyRevenue = {
    current: number;
    previous: number;
};

export type ClientWorkspaceFilter = {
    search: string;
    status: "all" | "active" | "inactive";
    clientType: "all" | Client["client_type"];
    relationship: "all" | "lead" | "client";
    city: string;
    contact: "all" | "complete" | "missing";
};

type BuildClientWorkspaceInput = {
    clients: Client[];
    locations: Location[];
    tasks: TaskItem[];
    invoices?: Invoice[];
    referenceDate?: Date;
};

const REVENUE_STATUSES = new Set<Invoice["status"]>([
    "issued",
    "paid",
    "overdue",
    "rectified",
]);
const PENDING_PAYMENT_STATUSES = new Set<Invoice["status"]>(["issued", "overdue"]);
const COMPLETE_TASK_STATUSES = new Set(["completed", "cancelled"]);

function validDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestActivity(current: string | null, candidate: string | null | undefined): string | null {
    const currentDate = validDate(current);
    const candidateDate = validDate(candidate);
    if (!candidateDate) return current;
    if (!currentDate || candidateDate > currentDate) return candidateDate.toISOString();
    return current;
}

function earliestFutureTask(
    current: string | null,
    candidate: string | null | undefined,
    referenceDate: Date,
): string | null {
    const candidateDate = validDate(candidate);
    if (!candidateDate || candidateDate < referenceDate) return current;
    const currentDate = validDate(current);
    if (!currentDate || candidateDate < currentDate) return candidateDate.toISOString();
    return current;
}

function clientHasContact(client: Client): boolean {
    return Boolean(client.email?.trim() || client.phone?.trim());
}

function isPendingTask(task: TaskItem): boolean {
    return !COMPLETE_TASK_STATUSES.has(task.status);
}

function isInvoiceFromYear(invoice: Invoice, year: number): boolean {
    return validDate(invoice.issue_date)?.getUTCFullYear() === year;
}

/**
 * Joins data that has already passed the API authorization boundary. Keeping
 * this calculation here lets the list, detail and CSV export share exactly
 * the same operational and financial figures.
 */
export function buildClientWorkspace({
    clients,
    locations,
    tasks,
    invoices,
    referenceDate = new Date(),
}: BuildClientWorkspaceInput): ClientWorkspace {
    const rowsByClientId = new Map<number, ClientWorkspaceRow>(
        clients.map((client) => [
            client.id,
            {
                client,
                locationCount: 0,
                taskCount: 0,
                pendingTaskCount: 0,
                annualBillingTotal: 0,
                pendingBalance: 0,
                lastActivityAt: null,
                nextScheduledAt: null,
                hasContact: clientHasContact(client),
            },
        ]),
    );
    const locationClientIds = new Map<number, number>();

    for (const location of locations) {
        if (location.client_id == null || !rowsByClientId.has(location.client_id)) continue;
        locationClientIds.set(location.id, location.client_id);
        const row = rowsByClientId.get(location.client_id);
        if (row) row.locationCount += 1;
    }

    for (const task of tasks) {
        const clientId = locationClientIds.get(task.location_id);
        if (clientId == null) continue;
        const row = rowsByClientId.get(clientId);
        if (!row) continue;
        row.taskCount += 1;
        if (isPendingTask(task)) row.pendingTaskCount += 1;
        row.lastActivityAt = latestActivity(row.lastActivityAt, task.updated_at || task.created_at);
        row.nextScheduledAt = earliestFutureTask(row.nextScheduledAt, task.scheduled_start_at, referenceDate);
    }

    const year = referenceDate.getUTCFullYear();
    for (const invoice of invoices ?? []) {
        const row = rowsByClientId.get(invoice.client_id);
        if (!row) continue;
        row.lastActivityAt = latestActivity(row.lastActivityAt, invoice.updated_at || invoice.created_at);
        if (!isInvoiceFromYear(invoice, year)) continue;
        if (REVENUE_STATUSES.has(invoice.status)) row.annualBillingTotal += invoice.total_amount;
        if (PENDING_PAYMENT_STATUSES.has(invoice.status)) row.pendingBalance += invoice.total_amount;
    }

    const rows = clients
        .map((client) => rowsByClientId.get(client.id))
        .filter((row): row is ClientWorkspaceRow => Boolean(row));

    return { rows, summary: summarizeClientWorkspaceRows(rows, invoices !== undefined) };
}

export function summarizeClientWorkspaceRows(
    rows: ClientWorkspaceRow[],
    hasFinancialData: boolean,
): ClientWorkspaceSummary {
    return {
        clientCount: rows.length,
        activeClientCount: rows.filter((row) => row.client.is_active).length,
        missingContactCount: rows.filter((row) => !row.hasContact).length,
        locationCount: rows.reduce((sum, row) => sum + row.locationCount, 0),
        pendingTaskCount: rows.reduce((sum, row) => sum + row.pendingTaskCount, 0),
        annualBillingTotal: rows.reduce((sum, row) => sum + row.annualBillingTotal, 0),
        pendingBalanceTotal: rows.reduce((sum, row) => sum + row.pendingBalance, 0),
        hasFinancialData,
    };
}

export function getClientWorkspaceMonthlyRevenue(
    invoices: Invoice[] | undefined,
    rows: ClientWorkspaceRow[],
    referenceDate: Date,
): ClientWorkspaceMonthlyRevenue | null {
    if (!invoices) return null;

    const clientIds = new Set(rows.map((row) => row.client.id));
    const currentMonth = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1);
    const previousMonth = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1);
    let current = 0;
    let previous = 0;

    for (const invoice of invoices) {
        if (!clientIds.has(invoice.client_id) || !REVENUE_STATUSES.has(invoice.status)) continue;
        const issueDate = validDate(invoice.issue_date);
        if (!issueDate) continue;
        const issuedMonth = Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1);
        if (issuedMonth === currentMonth) current += invoice.total_amount;
        if (issuedMonth === previousMonth) previous += invoice.total_amount;
    }

    return { current, previous };
}

export function filterClientWorkspaceRows(
    rows: ClientWorkspaceRow[],
    filters: ClientWorkspaceFilter,
): ClientWorkspaceRow[] {
    const search = filters.search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
        const { client } = row;
        const matchesStatus = filters.status === "all"
            || (filters.status === "active" && client.is_active)
            || (filters.status === "inactive" && !client.is_active);
        const matchesType = filters.clientType === "all" || client.client_type === filters.clientType;
        const matchesRelationship = filters.relationship === "all"
            || (client.relationship_status ?? "client") === filters.relationship;
        const matchesCity = !filters.city || client.city === filters.city;
        const matchesContact = filters.contact === "all"
            || (filters.contact === "complete" && row.hasContact)
            || (filters.contact === "missing" && !row.hasContact);
        const matchesSearch = !search || [
            client.name,
            client.legal_number,
            client.email,
            client.phone,
            client.address,
            client.city,
        ].some((value) => value?.toLocaleLowerCase().includes(search));

        return matchesStatus && matchesType && matchesRelationship && matchesCity && matchesContact && matchesSearch;
    });
}

export function getClientWorkspaceCities(rows: ClientWorkspaceRow[]): string[] {
    const cities = new Set<string>();
    for (const row of rows) {
        const city = row.client.city.trim();
        if (city) cities.add(city);
    }
    return Array.from(cities).sort((left, right) => left.localeCompare(right));
}

function csvCell(value: string | number | null | undefined): string {
    const normalized = value == null ? "" : String(value);
    const protectedValue = /^[=+\-@]/.test(normalized.trimStart()) ? `'${normalized}` : normalized;
    return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function buildClientWorkspaceCsv(
    rows: ClientWorkspaceRow[],
    options: { includeFinancialData: boolean; year: number },
): string {
    const headers = [
        "Cliente",
        "NIF/CIF",
        "Tipo",
        "Email",
        "Teléfono",
        "Dirección",
        "Ciudad",
        "Ubicaciones",
        "Trabajos",
        "Trabajos pendientes",
        ...(options.includeFinancialData ? [`Facturación ${options.year}`, "Saldo pendiente"] : []),
        "Estado",
    ];
    const rowsCsv = rows.map((row) => [
        row.client.name,
        row.client.legal_number,
        row.client.client_type,
        row.client.email,
        row.client.phone,
        row.client.address,
        row.client.city,
        row.locationCount,
        row.taskCount,
        row.pendingTaskCount,
        ...(options.includeFinancialData ? [row.annualBillingTotal, row.pendingBalance] : []),
        row.client.is_active ? "Activo" : "Inactivo",
    ].map(csvCell).join(";"));

    return [headers.map(csvCell).join(";"), ...rowsCsv].join("\n");
}
