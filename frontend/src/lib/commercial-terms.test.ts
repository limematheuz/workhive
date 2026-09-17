import assert from "node:assert/strict";
import test from "node:test";

import {
    commercialTermsFormValue,
    commercialTermsPayload,
    formatCommercialAmount,
} from "./commercial-terms.ts";

test("commercial terms convert a localized euro amount to exact cents", () => {
    const payload = commercialTermsPayload({
        billing_interval: "annual",
        amount: "708,00",
        currency: "eur",
        tax_behavior: "exclusive",
        effective_at: "2026-09-16",
    });

    assert.deepEqual(payload, {
        billing_interval: "annual",
        amount_cents: 70800,
        currency: "EUR",
        tax_behavior: "exclusive",
        effective_at: "2026-09-16T00:00:00Z",
    });
});

test("commercial terms reject imprecise amounts and preserve stored snapshots", () => {
    assert.equal(
        commercialTermsPayload({
            billing_interval: "monthly",
            amount: "29.999",
            currency: "EUR",
            tax_behavior: "exclusive",
            effective_at: "2026-09-16",
        }),
        null,
    );
    assert.equal(formatCommercialAmount(2900), "29.00");
    assert.deepEqual(
        commercialTermsFormValue({
            billing_interval: "monthly",
            amount_cents: 2900,
            currency: "EUR",
            tax_behavior: "exclusive",
            effective_at: "2026-09-16T00:00:00Z",
        }),
        {
            billing_interval: "monthly",
            amount: "29.00",
            currency: "EUR",
            tax_behavior: "exclusive",
            effective_at: "2026-09-16",
        },
    );
});
