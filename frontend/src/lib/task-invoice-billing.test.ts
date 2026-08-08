import assert from "node:assert/strict";
import test from "node:test";

import {
    buildTaskWorkSummaryLines,
    resolveTaskInvoiceAmount,
    resolveTaskInvoiceBilling,
} from "./task-invoice-billing.ts";

test("fixed mode uses configured quantity and price", () => {
    assert.deepEqual(
        resolveTaskInvoiceBilling({
            pricing_mode: "fixed",
            price: 165,
            quantity: 2,
            worked_hours: 9,
        }),
        { unitPrice: 165, quantity: 2 },
    );
    assert.equal(
        resolveTaskInvoiceAmount({
            pricing_mode: "fixed",
            price: 165,
            quantity: 2,
        }),
        330,
    );
});

test("hourly mode uses person-hours snapshot for quantity", () => {
    assert.deepEqual(
        resolveTaskInvoiceBilling({
            pricing_mode: "hourly",
            price: 20,
            quantity: 1,
            worked_hours: 4,
        }),
        { unitPrice: 20, quantity: 4 },
    );
    assert.equal(
        resolveTaskInvoiceAmount({
            pricing_mode: "hourly",
            price: 20,
            worked_seconds: 2 * 3600 + 30 * 60,
        }),
        50,
    );
});

test("work summary lines always include person-hours and workers", () => {
    const lines = buildTaskWorkSummaryLines(
        {
            pricing_mode: "fixed",
            price: 165,
            quantity: 1,
            worked_seconds: 9000,
            workers: [
                { user_id: 1, user_name: "Ana", worked_seconds: 2400, worked_hours: 0.6667 },
                { user_id: 2, user_name: "Bea", worked_seconds: 6600, worked_hours: 1.8333 },
            ],
        },
        (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
            if (hours > 0) return `${hours}h`;
            return `${minutes}m`;
        },
    );

    assert.deepEqual(lines, [
        "Horas-persona: 2h 30m",
        "Ana 40m · Bea 1h 50m",
    ]);
});
