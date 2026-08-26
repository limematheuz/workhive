import assert from "node:assert/strict";
import test from "node:test";

import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { Quote } from "@/types/quote";
import {
    buildQuotePayload,
    buildQuoteItemsSnapshot,
    createQuoteConceptRow,
    formatQuoteValidUntilDate,
    getQuoteIssuerFieldsFromCompany,
    getQuoteRecipientFieldsFromClient,
    mapQuoteItemsToConceptRows,
} from "./quote-form.ts";

const client: Client = {
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
};

test("quote valid-until date formats for date input", () => {
    assert.equal(formatQuoteValidUntilDate("2026-07-08T12:00:00.000Z"), "2026-07-08");
    assert.equal(formatQuoteValidUntilDate(null), "");
    assert.equal(formatQuoteValidUntilDate("bad-date"), "");
});

test("quote issuer fields keep company fiscal and bank data", () => {
    const fields = getQuoteIssuerFieldsFromCompany({
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

    assert.equal(fields.name, "Ownet");
    assert.equal(fields.bank, "ES0000");
    assert.equal(fields.swiftBic, "CAIXESBBXXX");
});

test("quote recipient fields include fiscal address data", () => {
    assert.deepEqual(getQuoteRecipientFieldsFromClient(client), {
        name: "Port Blanc",
        taxId: "B55370720",
        address: "Carrer del Gregal, 52",
        postalCode: "17130",
        city: "Girona",
        province: "",
        country: "España",
        phone: "621261405",
        email: "port@example.com",
    });
});

test("quote items map to editable concept rows", () => {
    const quote = {
        tax_rate: 0.21,
        items: [
            { id: 7, description: "Limpieza", unit_price: 165, quantity: 2 },
        ],
    } as Quote;
    const rows = mapQuoteItemsToConceptRows(quote);

    assert.deepEqual(rows, [{
        id: "7",
        description: "Limpieza",
        unitPrice: 165,
        quantity: 2,
        taxRate: 0.21,
    }]);
});

test("quote payload preserves optional document fields", () => {
    const payload = buildQuotePayload({
        selectedClientId: "25",
        title: "Presupuesto limpieza",
        validUntil: "2026-07-08",
        notesEnabled: false,
        notes: "hidden",
        taxRateGlobal: 0.21,
        discount: 5,
        equivalenceSurcharge: 0,
        retention: 0,
        termsEnabled: true,
        terms: "Terms",
        shippingAddress: "",
        customIssuerInfo: "Issuer",
        customRecipientInfo: "Recipient",
        signatureUrl: null,
    });

    assert.equal(payload.client_id, 25);
    assert.equal(payload.notes, null);
    assert.equal(payload.terms, "Terms");
    assert.equal(payload.shipping_address, null);
});

test("quote item snapshot contains every current row and no UI identifiers", () => {
    const concepts = [
        { id: "1", description: "Updated", quantity: 2, unitPrice: 15, taxRate: 0.21 },
        createQuoteConceptRow(0.21, "manual-new"),
    ];
    concepts[1].description = "New";
    concepts[1].unitPrice = 20;
    const result = buildQuoteItemsSnapshot(concepts);

    assert.deepEqual(result, [
        { description: "Updated", quantity: 2, unit_price: 15 },
        { description: "New", quantity: 1, unit_price: 20 },
    ]);
});

test("quote snapshots convert tax-inclusive entered prices to taxable bases", () => {
    assert.deepEqual(buildQuoteItemsSnapshot([
        { id: "1", description: "Servicio", quantity: 1, unitPrice: 380, taxRate: 0.21 },
    ], 0.21, true), [
        { description: "Servicio", quantity: 1, unit_price: 314.05 },
    ]);
});
