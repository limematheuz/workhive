import assert from "node:assert/strict";
import test from "node:test";

import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { InvoiceableTask } from "@/services/invoice.service";
import {
    buildInvoiceDraftPayload,
    forceInvoiceTasksClientId,
    getDefaultInvoiceDueDate,
    getIssuerFieldsFromCompany,
    getRecipientFieldsFromClient,
    resolveInvoiceClientId,
} from "./invoice-form.ts";

const clients: Client[] = [
    {
        id: 10,
        name: "Javier",
        client_type: "individual",
        email: "javier@example.com",
        phone: "600000000",
        address: "Calle Uno",
        city: "Barcelona",
        postal_code: "08001",
        country: "España",
        legal_number: "B11111111",
        is_active: true,
        company_id: 1,
    },
    {
        id: 25,
        name: "Port Blanc",
        client_type: "company",
        email: "port@example.com",
        phone: "621261405",
        address: "Carrer del Gregal, 52",
        city: "Girona",
        postal_code: "17130",
        country: "España",
        legal_number: "B55370720",
        is_active: true,
        company_id: 1,
    },
];

const selectedTasks: InvoiceableTask[] = [
    {
        id: 1,
        title: "Limpieza de salida",
        client_id: 10,
        client_name: "Port Blanc",
        location_name: "Casa Mercè",
        billing_source: "external",
    } as InvoiceableTask,
];

test("invoice form resolves collaborator client by task client name first", () => {
    const clientId = resolveInvoiceClientId({
        clients,
        initialTasks: selectedTasks,
        initialClientId: "10",
    });

    assert.equal(clientId, "25");
});

test("invoice form resolves client by task client id when name is absent", () => {
    const clientId = resolveInvoiceClientId({
        clients,
        initialTasks: [{ ...selectedTasks[0], client_name: "" }],
    });

    assert.equal(clientId, "10");
});

test("invoice form forces selected tasks to resolved client", () => {
    const normalized = forceInvoiceTasksClientId(selectedTasks, "25");

    assert.equal(normalized[0]?.client_id, 25);
    assert.equal(selectedTasks[0]?.client_id, 10);
});

test("billing party fields from client include fiscal address data", () => {
    const fields = getRecipientFieldsFromClient(clients[1]);

    assert.deepEqual(fields, {
        name: "Port Blanc",
        taxId: "B55370720",
        address: "Carrer del Gregal, 52\n17130 Girona, España",
        phone: "621261405",
        email: "port@example.com",
    });
});

test("billing party fields from company keep bank account", () => {
    const fields = getIssuerFieldsFromCompany({
        id: 1,
        name: "Ownet",
        tax_id: "Y1149377N",
        address: "Carrer Illa Mateua, 22",
        phone: "+34 634 92 09 23",
        email: "ownet@example.com",
        bank_account: "ES0000",
        swift_bic: "CAIXESBBXXX",
        is_active: true,
    } as Company);

    assert.equal(fields.bank, "ES0000");
    assert.equal(fields.swiftBic, "CAIXESBBXXX");
});

test("invoice draft payload maps concept rows and optional fields", () => {
    const payload = buildInvoiceDraftPayload({
        selectedClientId: "25",
        issueDate: "2026-06-23",
        dueDate: "2026-07-08",
        invoiceNumber: "FV/2026/0069",
        discount: 0,
        equivalenceSurcharge: 0,
        retention: 0,
        paymentMethod: "direct_debit",
        notesEnabled: false,
        notes: "hidden",
        termsEnabled: true,
        terms: "Terms",
        shippingAddress: "",
        customIssuerInfo: "Issuer",
        customRecipientInfo: "Recipient",
        signatureUrl: null,
        concepts: [{
            id: "task-1",
            description: "Limpieza",
            quantity: 1,
            unitPrice: 165,
            taxRate: 0.21,
            task_item_id: 1,
        }],
    });

    assert.equal(payload.client_id, 25);
    assert.equal(payload.invoice_number, "FV/2026/0069");
    assert.equal(payload.notes, null);
    assert.equal(payload.terms, "Terms");
    assert.equal(payload.shipping_address, null);
    assert.equal(payload.payment_method, "direct_debit");
    assert.deepEqual(payload.items, [{
        description: "Limpieza",
        quantity: 1,
        unit_price: 165,
        tax_rate: 0.21,
        task_item_id: 1,
    }]);
});

test("invoice due date defaults to fifteen days after issue date", () => {
    assert.equal(getDefaultInvoiceDueDate("2026-06-23"), "2026-07-08");
});
