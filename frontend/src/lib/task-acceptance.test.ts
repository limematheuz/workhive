import assert from "node:assert/strict";
import test from "node:test";

import {
    acceptancePricingValuesForTask,
    buildTaskAcceptancePayload,
    hasValidTaskAcceptancePricing,
} from "../domain/tasks/task-acceptance.ts";

test("external acceptance keeps the suggested fixed agreement editable", () => {
    const values = acceptancePricingValuesForTask({
        pricing_mode: "fixed",
        price: 145,
        quantity: 2,
        unit: "service",
    });

    assert.deepEqual(values, {
        pricingMode: "fixed",
        price: "145",
        quantity: "2",
        unit: "service",
    });
    assert.equal(hasValidTaskAcceptancePricing(values), true);
});

test("hourly acceptance sends a person-hour agreement and forces the hour unit", () => {
    const payload = buildTaskAcceptancePayload({
        scheduledStartAt: "2026-08-11T09:30:00.000Z",
        pricing: {
            pricingMode: "hourly",
            price: "25",
            quantity: "1",
            unit: "service",
        },
    });

    assert.deepEqual(payload, {
        scheduled_start_at: "2026-08-11T09:30:00.000Z",
        pricing_mode: "hourly",
        price: 25,
        quantity: 1,
        unit: "hour",
    });
    assert.equal(hasValidTaskAcceptancePricing({
        pricingMode: "hourly",
        price: "0",
        quantity: "1",
        unit: "hour",
    }), false);
});

test("an acceptance with no agreed price remains invalid for the backend contract", () => {
    const pricing = {
        pricingMode: "fixed" as const,
        price: "",
        quantity: "1",
        unit: "service",
    };

    assert.equal(hasValidTaskAcceptancePricing(pricing), false);
    assert.equal(buildTaskAcceptancePayload({ pricing }).price, null);
});
