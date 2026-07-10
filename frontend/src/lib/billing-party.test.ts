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
        phone: "+34 600 000 000",
        email: "billing@example.com",
        bank: "ES00 0000 0000 0000",
    };

    assert.deepEqual(parseBillingParty(formatBillingParty(fields)), fields);
});

test("updateBillingPartyField updates only the selected field", () => {
    const fields = parseBillingParty("Client\nEmail: old@example.com");
    assert.deepEqual(updateBillingPartyField(fields, "email", "new@example.com"), {
        ...fields,
        email: "new@example.com",
    });
});
