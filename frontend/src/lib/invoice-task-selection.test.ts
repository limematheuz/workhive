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
