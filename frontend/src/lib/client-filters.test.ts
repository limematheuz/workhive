import assert from "node:assert/strict";
import test from "node:test";

import {
    filterClients,
    normalizeClientSearch,
} from "./client-filters.ts";
import type { Client } from "../types/client.ts";

const clients: Client[] = [
    {
        id: 1,
        name: "Eva Chouza",
        client_type: "individual",
        email: "eva@example.com",
        phone: "600111222",
        address: "Carrer A",
        city: "L'Escala",
        postal_code: "17130",
        country: "ES",
        legal_number: "38106814T",
        is_active: true,
        company_id: 10,
    },
    {
        id: 2,
        name: "Port Blanc",
        client_type: "business",
        email: "info@portblanc.test",
        phone: null,
        address: "Carrer B",
        city: "L'Escala",
        postal_code: "17130",
        country: "ES",
        legal_number: "B12345678",
        is_active: false,
        company_id: 10,
    },
];

test("client search normalizes whitespace and case", () => {
    assert.equal(normalizeClientSearch("  EVA@example.COM  "), "eva@example.com");
});

test("client filter honors active inactive and all statuses", () => {
    assert.deepEqual(filterClients(clients, "", "active").map((client) => client.id), [1]);
    assert.deepEqual(filterClients(clients, "", "inactive").map((client) => client.id), [2]);
    assert.deepEqual(filterClients(clients, "", "all").map((client) => client.id), [1, 2]);
});

test("client filter searches name legal number email and phone with trimmed input", () => {
    assert.deepEqual(filterClients(clients, " chouza ", "all").map((client) => client.id), [1]);
    assert.deepEqual(filterClients(clients, "b123", "all").map((client) => client.id), [2]);
    assert.deepEqual(filterClients(clients, "PORTBLANC.TEST", "all").map((client) => client.id), [2]);
    assert.deepEqual(filterClients(clients, "600111", "all").map((client) => client.id), [1]);
});
