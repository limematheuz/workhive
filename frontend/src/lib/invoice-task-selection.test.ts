import assert from "node:assert/strict";
import test from "node:test";

import {
    buildInvoiceTaskConcepts,
    prepareInvoiceTasks,
} from "./invoice-task-selection.ts";

const portBlancTasks = [1, 2, 3].map(id => ({
    id,
    title: `Trabajo ${id}`,
    client_id: 25,
    client_name: "Port Blanc",
    location_name: `Casa ${id}`,
    billing_source: "external" as const,
    is_invoiced: false,
    price: 165,
    quantity: 1,
}));

test("selected collaborator jobs remain visible and selected in invoice form", () => {
    const result = prepareInvoiceTasks({
        fetchedTasks: [],
        initialTasks: portBlancTasks as never[],
        initialTaskIds: [1, 2, 3],
        selectedClientId: "25",
    });

    assert.deepEqual(result.selectedTaskIds, [1, 2, 3]);
    assert.equal(result.availableTasks.length, 3);
    assert.equal(result.availableTasks[0]?.locationName, "Casa 1");
});

test("jobs from another client are excluded", () => {
    const result = prepareInvoiceTasks({
        fetchedTasks: portBlancTasks as never[],
        initialTasks: [],
        initialTaskIds: [],
        selectedClientId: "99",
    });

    assert.deepEqual(result.availableTasks, []);
});

test("selected jobs always resolve to their collaborator client", () => {
    const selectedClientId = portBlancTasks[0]?.client_id?.toString();

    assert.equal(selectedClientId, "25");
    assert.notEqual(selectedClientId, "1");
});

test("fresh API client id replaces a stale selected-job client id", () => {
    const staleTask = { ...portBlancTasks[0], client_id: 1 };
    const refreshedTask = { ...portBlancTasks[0], client_id: 105 };
    const result = prepareInvoiceTasks({
        fetchedTasks: [refreshedTask] as never[],
        initialTasks: [staleTask] as never[],
        initialTaskIds: [1],
        selectedClientId: "105",
    });

    assert.deepEqual(result.selectedTaskIds, [1]);
    assert.equal(result.availableTasks[0]?.client_id, 105);
});

test("selected jobs become invoice concepts with price quantity and tax", () => {
    const prepared = prepareInvoiceTasks({
        fetchedTasks: portBlancTasks as never[],
        initialTasks: [],
        initialTaskIds: [1, 2, 3],
        selectedClientId: "25",
    });
    const concepts = buildInvoiceTaskConcepts(
        prepared.availableTasks,
        prepared.selectedTaskIds,
        0.21,
    );

    assert.equal(concepts.length, 3);
    assert.deepEqual(
        concepts.map(item => ({
            task: item.task_item_id,
            price: item.unitPrice,
            quantity: item.quantity,
            tax: item.taxRate,
        })),
        [
            { task: 1, price: 165, quantity: 1, tax: 0.21 },
            { task: 2, price: 165, quantity: 1, tax: 0.21 },
            { task: 3, price: 165, quantity: 1, tax: 0.21 },
        ],
    );
});

test("hourly jobs become invoice concepts from person-hours times rate", () => {
    const hourlyTask = {
        id: 9,
        title: "Limpieza horaria",
        client_id: 25,
        client_name: "Port Blanc",
        location_name: "Casa Horas",
        billing_source: "own" as const,
        is_invoiced: false,
        pricing_mode: "hourly" as const,
        price: 20,
        quantity: 1,
        worked_hours: 2.5,
        worked_seconds: 9000,
        date_done: "2026-08-08T12:00:00Z",
        created_at: "2026-08-08T08:00:00Z",
        unit: "hour",
        workers: [
            { user_id: 1, user_name: "Ana", worked_seconds: 2400, worked_hours: 0.6667 },
            { user_id: 2, user_name: "Bea", worked_seconds: 3600, worked_hours: 1 },
            { user_id: 3, user_name: "Carla", worked_seconds: 1800, worked_hours: 0.5 },
            { user_id: 4, user_name: "Diana", worked_seconds: 1200, worked_hours: 0.3333 },
        ],
    };
    const concepts = buildInvoiceTaskConcepts(
        [hourlyTask as never],
        [9],
        0.21,
    );

    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.unitPrice, 20);
    assert.equal(concepts[0]?.quantity, 2.5);
    assert.match(concepts[0]?.description || "", /Tiempo del equipo: 2h 30m/);
    assert.match(concepts[0]?.description || "", /Ana 40m/);
    assert.match(concepts[0]?.description || "", /Cobro: 2\.5 h × 20 €\/h/);
    assert.match(concepts[0]?.description || "", /Casa Horas · /);
});

test("fixed-price jobs still expose recorded person-hours in the concept", () => {
    const fixedTask = {
        id: 11,
        title: "Limpieza fija",
        client_id: 25,
        client_name: "Port Blanc",
        location_name: "Casa Fija",
        billing_source: "own" as const,
        is_invoiced: false,
        pricing_mode: "fixed" as const,
        price: 165,
        quantity: 1,
        worked_seconds: 7200,
        worked_hours: 2,
        unit: "service",
        workers: [
            { user_id: 1, user_name: "Ana", worked_seconds: 3600, worked_hours: 1 },
            { user_id: 2, user_name: "Bea", worked_seconds: 3600, worked_hours: 1 },
        ],
    };
    const concepts = buildInvoiceTaskConcepts(
        [fixedTask as never],
        [11],
        0.21,
    );

    assert.equal(concepts[0]?.unitPrice, 165);
    assert.equal(concepts[0]?.quantity, 1);
    assert.match(concepts[0]?.description || "", /Tiempo del equipo: 2h/);
    assert.match(concepts[0]?.description || "", /Ana 1h · Bea 1h/);
});
