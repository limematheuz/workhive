import assert from "node:assert/strict";
import test from "node:test";
import {
    formatBillingParty,
    parseBillingParty,
    updateBillingPartyField,
} from "./billing-party.ts";

test("billing party data round-trips through the stored text format", () => {
    const fields = {
        name: "WorkHive SL",
        taxId: "B12345678",
        address: "Main Street 1",
        postalCode: "08001",
        city: "Barcelona",
        province: "Barcelona",
        country: "España",
        phone: "+34 600 000 000",
        email: "billing@example.com",
        bank: "ES00 0000 0000 0000",
        swiftBic: "CAIXESBBXXX",
    };

    assert.deepEqual(parseBillingParty(formatBillingParty(fields)), fields);
});

test("billing party parses legacy unlabelled postal city and country", () => {
    const fields = parseBillingParty(
        "Port Blanc\nNIF/CIF: B55370720\nDirección: Carrer del Gregal, 52\n17130 L'Escala, España",
    );

    assert.equal(fields.address, "Carrer del Gregal, 52");
    assert.equal(fields.postalCode, "17130");
    assert.equal(fields.city, "L'Escala");
    assert.equal(fields.country, "España");
});

test("updateBillingPartyField updates only the selected field", () => {
    const fields = parseBillingParty("Client\nEmail: old@example.com");
    assert.deepEqual(updateBillingPartyField(fields, "email", "new@example.com"), {
        ...fields,
        email: "new@example.com",
    });
});
