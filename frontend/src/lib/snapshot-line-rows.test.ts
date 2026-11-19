import test from "node:test";
import assert from "node:assert/strict";
import { snapshotLineRows } from "./snapshot-line-rows.ts";

test("snapshot line identity remains stable when another concept is inserted and duplicates stay distinct", () => {
    const cleaning = { description: "Limpieza", quantity: "2", unit_price: "10", subtotal: "20" };
    const materials = { description: "Material", quantity: "1", unit_price: "5", subtotal: "5" };
    const before = snapshotLineRows([cleaning, cleaning]);
    const after = snapshotLineRows([materials, cleaning, cleaning]);
    assert.notEqual(before[0].key, before[1].key);
    assert.deepEqual(after.slice(1).map(row => row.key), before.map(row => row.key));
    assert.equal(after[1].line, cleaning);
});
