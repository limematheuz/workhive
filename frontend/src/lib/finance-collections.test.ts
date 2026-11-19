import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { collectPaginated } from "./pagination.ts";

function service(name: string, path: string, fetch: (path: string) => Promise<unknown>) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8").replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
    const script = stripTypeScriptTypes(source, { mode: "strip" }).replace(/export\s+(?=const|function|class)/g, "");
    return new Function("apiFetch", "assertApiResponseOk", "extractErrorMessage", "collectPaginated", "LocationWorkspaceService", `${script}\nreturn ${name};`)(fetch, async (response: { ok?: boolean }) => { if (response.ok === false) throw new Error("Access denied or unavailable page"); }, async () => "error", collectPaginated, {});
}

test("invoice, quote and ledger collectors include records beyond the first page and preserve filters", async () => {
    for (const spec of [
        { name: "InvoiceService", path: "../services/invoice.service.ts", method: "getAllInvoices", filters: { clientId: 2, status: "issued" }, client: "client_id", status: "invoice_status" },
        { name: "QuoteService", path: "../services/quote.service.ts", method: "getAllQuotes", filters: { clientId: 2, status: "sent" }, client: "client_id", status: "quote_status" },
        { name: "SalesLedgerService", path: "../services/sales-ledger.service.ts", method: "getAllEntries", filters: { year: 2026, search: "Alpha" }, client: "", status: "" },
    ]) {
        const source = Array.from({ length: 1205 }, (_, index) => ({ id: index + 1 }));
        const queries: URLSearchParams[] = [];
        const instance = service(spec.name, spec.path, async (path) => {
            const query = new URL(path, "https://local.test").searchParams;
            queries.push(query);
            const skip = Number(query.get("skip") ?? 0), limit = Number(query.get("limit") ?? 100);
            return { json: async () => source.slice(skip, skip + limit) };
        });
        const rows = await instance[spec.method](spec.filters);
        assert.equal(rows.length, 1205, spec.name);
        assert.equal(rows.at(-1)?.id, 1205);
        assert.equal(queries.length, 3);
        for (const query of queries) {
            if (spec.client) { assert.equal(query.get(spec.client), "2"); assert.equal(query.get(spec.status), spec.filters.status); }
            else { assert.equal(query.get("year"), "2026"); assert.equal(query.get("search"), "Alpha"); }
        }
    }
});

test("an incomplete or unbounded collection raises an error instead of returning false totals", async () => {
    await assert.rejects(collectPaginated(async () => [1, 2], 2, 3), /safety limit/);
    await assert.rejects(collectPaginated(async (skip) => { if (skip > 0) throw new Error("temporarily unavailable"); return [1, 2]; }, 2, 3), /temporarily unavailable/);
});

test("complete client and location catalogs retain their filters beyond record 1200", async () => {
    for (const kind of ["client", "location"]) {
        const queries: URLSearchParams[] = [];
        const dataset = Array.from({ length: 1205 }, (_, index) => ({ id: index + 1 }));
        const instance = service(kind === "client" ? "ClientService" : "LocationService", kind === "client" ? "../services/client.service.ts" : "../services/location.service.ts", async (path) => {
            const query = new URL(path, "https://local.test").searchParams; queries.push(query);
            const start = Number(query.get("skip") ?? 0), limit = Number(query.get("limit") ?? 100);
            return { ok: true, json: async () => dataset.slice(start, start + limit) };
        });
        const rows = kind === "client" ? await instance.getAllClients(null) : await instance.getAllLocations(7);
        assert.equal(rows.length, 1205);
        assert.equal(rows.at(-1)?.id, 1205);
        assert.equal(queries.length, 3);
        for (const query of queries) assert.equal(query.get(kind === "client" ? "include_inactive" : "client_id"), kind === "client" ? "true" : "7");
    }
});

test("a denied later catalog page rejects the complete result instead of manufacturing an empty last page", async () => {
    for (const kind of ["client", "location"]) {
        const instance = service(kind === "client" ? "ClientService" : "LocationService", kind === "client" ? "../services/client.service.ts" : "../services/location.service.ts", async (path) => {
            const query = new URL(path, "https://local.test").searchParams;
            if (Number(query.get("skip") ?? 0) > 0) return { status: 403, ok: false, json: async () => [] };
            return { status: 200, ok: true, json: async () => Array.from({ length: 500 }, (_, id) => ({ id })) };
        });
        await assert.rejects(kind === "client" ? instance.getAllClients(null) : instance.getAllLocations(), /denied/);
    }
});

test("legacy optional client selectors retain empty denied choices while complete reads reject the denial", async () => {
    const instance = service("ClientService", "../services/client.service.ts", async () => ({ status: 403, ok: false, json: async () => [] }));
    assert.deepEqual(await instance.getClients(), []);
    assert.deepEqual(await instance.getClients(null), []);
    await assert.rejects(instance.getAllClients(null), /denied/);
});
