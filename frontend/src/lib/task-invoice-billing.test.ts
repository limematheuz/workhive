import assert from "node:assert/strict";
import test from "node:test";

import {
    applyConceptBillingMode,
    buildInvoiceTaskDescription,
    composeInvoiceConceptDescription,
    parseInvoiceConceptDescription,
    resolveTaskInvoiceAmount,
    resolveTaskInvoiceBilling,
} from "./task-invoice-billing.ts";

function formatHours(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

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

test("invoice description keeps a clear hierarchy for the client", () => {
    const description = buildInvoiceTaskDescription({
        title: "Limpieza de cambios",
        locationName: "Casa Anastasia",
        dateLabel: "08/08/2026",
        task: {
            pricing_mode: "fixed",
            price: 180,
            quantity: 1,
            worked_seconds: 4260,
            workers: [
                { user_id: 1, user_name: "Andrea", worked_seconds: 3720, worked_hours: 1.0333 },
                { user_id: 2, user_name: "Ownet", worked_seconds: 480, worked_hours: 0.1333 },
                { user_id: 3, user_name: "Victoria", worked_seconds: 0, worked_hours: 0 },
            ],
        },
        formatHours,
    });

    assert.equal(
        description,
        [
            "Limpieza de cambios",
            "Casa Anastasia",
            "08/08/2026",
            "",
            "Tiempo del equipo: 1h 11m",
            "Andrea: 1h 2m",
            "Ownet: 8m",
        ].join("\n"),
    );
    assert.doesNotMatch(description, /Victoria/);
});

test("parseInvoiceConceptDescription separates title location date and workers", () => {
    assert.deepEqual(
        parseInvoiceConceptDescription(
            [
                "Limpieza de cambios",
                "Casa Anastasia",
                "08/08/2026",
                "",
                "Tiempo del equipo: 1h 11m",
                "Andrea: 1h 2m",
                "Ownet: 8m",
            ].join("\n"),
        ),
        {
            title: "Limpieza de cambios",
            location: "Casa Anastasia",
            date: "08/08/2026",
            teamTime: "1h 11m",
            workers: [
                { name: "Andrea", time: "1h 2m" },
                { name: "Ownet", time: "8m" },
            ],
            charge: null,
            extras: [],
        },
    );
});

test("composeInvoiceConceptDescription round-trips structured parts", () => {
    const composed = composeInvoiceConceptDescription({
        title: "Limpieza de cambios",
        location: "Casa Anastasia",
        date: "08/08/2026",
        teamTime: "1h 11m",
        workers: [
            { name: "Andrea", time: "1h 2m" },
            { name: "Ownet", time: "8m" },
        ],
    });
    assert.deepEqual(
        parseInvoiceConceptDescription(composed),
        {
            title: "Limpieza de cambios",
            location: "Casa Anastasia",
            date: "08/08/2026",
            teamTime: "1h 11m",
            workers: [
                { name: "Andrea", time: "1h 2m" },
                { name: "Ownet", time: "8m" },
            ],
            charge: null,
            extras: [],
        },
    );
});

test("applyConceptBillingMode converts fixed price to hours times rate", () => {
    const hourly = applyConceptBillingMode(
        {
            unitPrice: 180,
            quantity: 1,
            pricing_mode: "fixed" as const,
            worked_seconds: 4260,
        },
        "hourly",
        { hourlyRate: 20 },
    );
    assert.equal(hourly.pricing_mode, "hourly");
    assert.equal(hourly.unitPrice, 20);
    assert.equal(hourly.quantity, 1.1833);
    assert.equal(Number((hourly.unitPrice * hourly.quantity).toFixed(2)), 23.67);

    const fixed = applyConceptBillingMode(hourly, "fixed");
    assert.equal(fixed.pricing_mode, "fixed");
    assert.equal(fixed.quantity, 1);
    assert.equal(fixed.unitPrice, 23.67);
});
