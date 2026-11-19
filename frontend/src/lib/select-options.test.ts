import assert from "node:assert/strict";
import test from "node:test";
import { nextSelectableIndex, searchSelectOptions } from "./select-options.ts";

test("entity lookup matches accents and tokens across a name and its description", () => {
    const rows = [{ value: "1", label: "María López", description: "Barcelona · Limpieza" }, { value: "2", label: "Juan", description: "Madrid" }];
    assert.deepEqual(searchSelectOptions(rows, "maria barcelona").items.map(row => row.value), ["1"]);
    assert.equal(searchSelectOptions(rows, "lopez limpieza").total, 1);
    assert.equal(searchSelectOptions(rows, "inexistente").total, 0);
});
test("entity lookup bounds rendered results and reports further matches", () => {
    const rows = Array.from({ length: 150 }, (_, index) => ({ value: String(index), label: `Cliente ${index}` }));
    assert.equal(searchSelectOptions(rows, "").items.length, 40);
    assert.equal(searchSelectOptions(rows, "", 1000).items.length, 100);
    assert.equal(searchSelectOptions(rows, "", 8).hasMore, true);
    assert.equal(searchSelectOptions(rows, "Cliente 149").hasMore, false);
});
test("keyboard selection wraps and skips disabled records", () => {
    const rows = [{ value: "1", label: "Uno", disabled: true }, { value: "2", label: "Dos" }, { value: "3", label: "Tres" }];
    assert.equal(nextSelectableIndex(rows, -1, 1), 1);
    assert.equal(nextSelectableIndex(rows, 2, 1), 1);
    assert.equal(nextSelectableIndex(rows, 1, -1), 2);
    assert.equal(nextSelectableIndex([], 0, 1), -1);
    assert.equal(nextSelectableIndex([{ value: "1", label: "Uno", disabled: true }], -1, 1), -1);
});
