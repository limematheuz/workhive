import test from "node:test";
import assert from "node:assert/strict";
import { readListAppearance, orderedListItems } from "./list-appearance.ts";
import { readSharedView, readSavedViews, shareViewUrl } from "./saved-views.ts";

test("column preferences discard foreign fields and keep required identity readable", () => {
    const columns = [{ key: "name", hideable: false }, { key: "status" }, { key: "date" }];
    assert.deepEqual(readListAppearance(JSON.stringify({ hidden: ["name", "status", "foreign", "status"], density: "compact" }), columns),
        { hidden: ["status"], density: "compact", sort: "default" });
    const remaining = readListAppearance('{"hidden":["a","b"]}', [{ key: "a" }, { key: "b" }]);
    assert(!remaining.hidden.includes("a"));
    assert.equal(readListAppearance('{"density":"unsupported"}').density, "comfortable");
});
test("sorting a visible list never mutates its source collection or balances", () => {
    const invoices = [{ id: 2, balance: 25 }, { id: 1, balance: 10 }];
    assert.deepEqual(orderedListItems(invoices, (first, second) => first.id - second.id).map(row => row.id), [1, 2]);
    assert.deepEqual(invoices.map(row => row.id), [2, 1]);
    assert.equal(invoices.reduce((total, row) => total + row.balance, 0), 35);
});
test("shared views are bound to one screen and whitelist only its filters", () => {
    const raw = JSON.stringify({ version: 1, viewKey: "invoices", filters: { status: "sent", company_id: "99", role: "superadmin" }, appearance: { density: "compact", hidden: ["notes"], sort: "number" } });
    const parsed = readSharedView(raw, "invoices", ["status", "search"]);
    assert.deepEqual(parsed?.filters, { status: "sent", search: "" });
    assert.equal(readSharedView(raw, "tasks", ["status"]), null);
    assert.equal(readSharedView(JSON.stringify({ version: 1, viewKey: "invoices", filters: { status: { role: "admin" } } }), "invoices", ["status"]), null);
    assert.equal(readSharedView("x".repeat(8193), "invoices", ["status"]), null);
});
test("saved and shared states preserve the same filter selection and table appearance", () => {
    const state = { version: 1 as const, viewKey: "invoices", filters: { attention: "overdue", month: "", search: "Marina & centro" }, appearance: { density: "compact" as const, hidden: ["notes"], sort: "amount-desc" } };
    const url = new URL(shareViewUrl("https://app.example.com/dashboard/invoices?month=2026-01", state));
    assert.equal(url.origin, "https://app.example.com");
    assert.equal(url.pathname, "/dashboard/invoices");
    assert.equal(url.searchParams.get("attention"), "overdue");
    assert.equal(url.searchParams.has("month"), false);
    const keys = ["attention", "month", "search"];
    assert.deepEqual(readSharedView(url.searchParams.get("wh_view"), "invoices", keys), state);
    const saved = readSavedViews(JSON.stringify([{ ...state, id: "saved-1", name: "Vencidas Marina", updatedAt: "2026-11-19T10:00:00Z" }]), "invoices", keys);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].appearance, state.appearance);
    assert.deepEqual(readSavedViews(JSON.stringify(saved), "tasks", keys), []);
    assert.throws(() => shareViewUrl("javascript:alert(1)", state));
});
