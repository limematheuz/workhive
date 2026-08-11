import assert from "node:assert/strict";
import test from "node:test";

import {
    editableTaskPricingUpdate,
    hasValidTaskPricingAgreement,
    pricingValuesForTaskCreation,
    pricingValuesForTaskEdit,
    resolveTaskCreationPricing,
} from "./task-pricing.ts";
import type { TaskPricingState } from "./task-pricing.ts";

function makeTask(overrides: TaskPricingState = {}): TaskPricingState {
    return {
        price: 120,
        quantity: 1,
        unit: "service",
        pricing_mode: "fixed",
        ...overrides,
    };
}

test("own task sends agreed pricing until the first start", () => {
    const task = makeTask();
    const values = {
        ...pricingValuesForTaskEdit(task),
        price: "135",
        quantity: "2",
        unit: "service",
    };

    const payload = editableTaskPricingUpdate(task, values);

    assert.equal(payload.pricing_mode, "fixed");
    assert.equal(payload.price, 135);
    assert.equal(payload.quantity, 2);
    assert.equal(payload.unit, "service");
});

test("locked task shows its frozen terms and does not send commercial changes", () => {
    const task = makeTask({
        price: 999,
        quantity: 99,
        unit: "changed",
        pricing_mode: "hourly",
        pricing_locked_at: "2026-08-10T08:00:00Z",
        billing_pricing_mode_snapshot: "fixed",
        billing_price_snapshot: 120,
        billing_quantity_snapshot: 1,
        billing_unit_snapshot: "service",
    });
    const values = pricingValuesForTaskEdit(task);
    const payload = editableTaskPricingUpdate(task, {
        ...values,
        price: "1",
        quantity: "50",
        unit: "changed",
        pricingMode: "hourly",
    });

    assert.equal(values.pricingMode, "fixed");
    assert.equal(values.price, "120");
    assert.equal(values.quantity, "1");
    assert.equal(values.unit, "service");
    assert.equal("pricing_mode" in payload, false);
    assert.equal("price" in payload, false);
    assert.equal("quantity" in payload, false);
    assert.equal("unit" in payload, false);
});

test("agreed terms can be edited before work but never after it starts", () => {
    const task = makeTask({
    });
    const values = {
        ...pricingValuesForTaskEdit(task),
        pricingMode: "hourly" as const,
        price: "25",
        quantity: "1",
        unit: "hour",
    };

    const beforeStart = editableTaskPricingUpdate(task, values);
    const afterStart = editableTaskPricingUpdate(
        { ...task, pricing_locked_at: "2026-08-10T08:00:00Z" },
        values,
    );

    assert.equal(beforeStart.pricing_mode, "hourly");
    assert.equal(beforeStart.price, 25);
    assert.equal(beforeStart.unit, "hour");
    assert.equal("pricing_mode" in afterStart, false);
    assert.equal("price" in afterStart, false);
    assert.equal("quantity" in afterStart, false);
    assert.equal("unit" in afterStart, false);
});

test("fixed work accepts an intentional zero price while hourly work requires a rate", () => {
    assert.equal(hasValidTaskPricingAgreement("fixed", 0), true);
    assert.equal(hasValidTaskPricingAgreement("fixed", null), false);
    assert.equal(hasValidTaskPricingAgreement("hourly", 0), false);
    assert.equal(hasValidTaskPricingAgreement("hourly", 25), true);
});

test("a work order can override its template pricing without changing the template default", () => {
    const defaults = {
        pricingMode: "fixed" as const,
        price: 180,
        unit: "service",
    };

    assert.deepEqual(pricingValuesForTaskCreation(defaults), {
        pricingMode: "fixed",
        price: "180",
    });
    assert.deepEqual(resolveTaskCreationPricing(defaults, {
        pricingMode: "hourly",
        price: "27.5",
    }), {
        pricingMode: "hourly",
        price: 27.5,
        unit: "hour",
    });
    assert.deepEqual(resolveTaskCreationPricing(defaults), {
        pricingMode: "fixed",
        price: 180,
        unit: "service",
    });
});
