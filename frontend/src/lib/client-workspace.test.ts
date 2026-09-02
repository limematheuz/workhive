import assert from "node:assert/strict";
import test from "node:test";

import {
    buildClientWorkspace,
    buildClientWorkspaceCsv,
    filterClientWorkspaceRows,
    getClientWorkspaceMonthlyRevenue,
    summarizeClientWorkspaceRows,
} from "./client-workspace.ts";
import type { Client } from "../types/client.ts";
import type { Location } from "../types/location.ts";
import type { TaskItem } from "../types/user.ts";
import type { Invoice } from "../types/invoice.ts";

const clients: Client[] = [
    {
        id: 1,
        name: "Empresa Alpha",
        client_type: "business",
        relationship_status: "lead",
        email: "contacto@alpha.test",
        phone: "600111222",
        address: "Calle Uno 1",
        city: "Barcelona",
        postal_code: "08001",
        country: "España",
        legal_number: "B12345678",
        is_active: true,
        company_id: 10,
    },
    {
        id: 2,
        name: "Casa Beta",
        client_type: "individual",
        email: null,
        phone: null,
        address: "Calle Dos 2",
        city: "Girona",
        postal_code: "17001",
        country: "España",
        legal_number: null,
        is_active: false,
        company_id: 10,
    },
];

const locations: Location[] = [
    { id: 11, name: "Oficina Alpha", address: "Calle Uno 1", city: "Barcelona", client_id: 1, is_active: true },
    { id: 12, name: "Casa Beta", address: "Calle Dos 2", city: "Girona", client_id: 2, is_active: true },
];

const task = (id: number, locationId: number, status: TaskItem["status"], scheduledStartAt?: string): TaskItem => ({
    id,
    title: `Tarea ${id}`,
    unit: "servicio",
    location_id: locationId,
    user_id: null,
    status,
    priority: "medium",
    is_invoiced: false,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-02T10:00:00Z",
    scheduled_start_at: scheduledStartAt,
});

const invoice = (id: number, clientId: number, status: Invoice["status"], total: number): Invoice => ({
    id,
    invoice_number: `INV-2026-${id}`,
    client_id: clientId,
    company_id: 10,
    issue_date: "2026-08-03T10:00:00Z",
    status,
    base_amount: total / 1.21,
    tax_amount: total - total / 1.21,
    total_amount: total,
    is_rectification: false,
    fiscal_submission_status: "not_configured",
    discount: 0,
    equivalence_surcharge: 0,
    retention: 0,
    items: [],
    created_at: "2026-08-03T10:00:00Z",
    updated_at: "2026-08-04T10:00:00Z",
});

test("client workspace keeps operational and financial data scoped to each client", () => {
    const workspace = buildClientWorkspace({
        clients,
        locations,
        tasks: [
            task(1, 11, "pending", "2026-08-25T10:00:00Z"),
            task(2, 11, "completed"),
            task(3, 12, "progress"),
            task(4, 999, "pending"),
        ],
        invoices: [invoice(1, 1, "issued", 121), invoice(2, 1, "paid", 242)],
        referenceDate: new Date("2026-08-24T12:00:00Z"),
    });

    assert.deepEqual(workspace.summary, {
        clientCount: 2,
        activeClientCount: 1,
        missingContactCount: 1,
        locationCount: 2,
        pendingTaskCount: 2,
        annualBillingTotal: 363,
        pendingBalanceTotal: 121,
        hasFinancialData: true,
    });
    assert.deepEqual(workspace.rows.map((row) => ({
        id: row.client.id,
        locations: row.locationCount,
        tasks: row.taskCount,
        pending: row.pendingTaskCount,
        billed: row.annualBillingTotal,
        due: row.pendingBalance,
        next: row.nextScheduledAt,
    })), [
        { id: 1, locations: 1, tasks: 2, pending: 1, billed: 363, due: 121, next: "2026-08-25T10:00:00.000Z" },
        { id: 2, locations: 1, tasks: 1, pending: 1, billed: 0, due: 0, next: null },
    ]);
});

test("client workspace filters using real client fields only", () => {
    const rows = buildClientWorkspace({ clients, locations, tasks: [], referenceDate: new Date("2026-08-24T12:00:00Z") }).rows;

    assert.deepEqual(filterClientWorkspaceRows(rows, {
        search: "alpha",
        status: "all",
        clientType: "all",
        relationship: "all",
        city: "",
        contact: "all",
    }).map((row) => row.client.id), [1]);
    assert.deepEqual(filterClientWorkspaceRows(rows, {
        search: "",
        status: "all",
        clientType: "all",
        relationship: "lead",
        city: "",
        contact: "all",
    }).map((row) => row.client.id), [1]);
    assert.deepEqual(filterClientWorkspaceRows(rows, {
        search: "",
        status: "inactive",
        clientType: "individual",
        relationship: "client",
        city: "Girona",
        contact: "missing",
    }).map((row) => row.client.id), [2]);
});

test("client workspace monthly revenue compares only the filtered clients and adjacent months", () => {
    const rows = buildClientWorkspace({
        clients,
        locations,
        tasks: [],
        invoices: [],
        referenceDate: new Date("2026-08-24T12:00:00Z"),
    }).rows;
    const monthlyRevenue = getClientWorkspaceMonthlyRevenue([
        { ...invoice(1, 1, "issued", 300), issue_date: "2026-08-12T10:00:00Z" },
        { ...invoice(2, 1, "paid", 200), issue_date: "2026-07-12T10:00:00Z" },
        { ...invoice(3, 2, "issued", 900), issue_date: "2026-08-12T10:00:00Z" },
        { ...invoice(4, 1, "draft", 500), issue_date: "2026-08-12T10:00:00Z" },
    ], [rows[0]!], new Date("2026-08-24T12:00:00Z"));

    assert.deepEqual(monthlyRevenue, { current: 300, previous: 200 });
    assert.deepEqual(summarizeClientWorkspaceRows([rows[0]!], true), {
        clientCount: 1,
        activeClientCount: 1,
        missingContactCount: 0,
        locationCount: 1,
        pendingTaskCount: 0,
        annualBillingTotal: 0,
        pendingBalanceTotal: 0,
        hasFinancialData: true,
    });
});

test("client CSV escapes spreadsheet formulas and keeps financial columns permission-aware", () => {
    const workspace = buildClientWorkspace({
        clients: [{ ...clients[0], name: "=IMPORTXML(A1)" }],
        locations,
        tasks: [],
        invoices: [invoice(1, 1, "issued", 121)],
        referenceDate: new Date("2026-08-24T12:00:00Z"),
    });

    const csv = buildClientWorkspaceCsv(workspace.rows, { includeFinancialData: false, year: 2026 });
    assert.match(csv, /"'=IMPORTXML\(A1\)"/);
    assert.doesNotMatch(csv.split("\n")[0], /Facturación/);
});
