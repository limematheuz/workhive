import assert from "node:assert/strict";
import test from "node:test";

import { collectPaginated } from "./pagination.ts";

test("pagination collects every page without dropping records", async () => {
    const source = Array.from({ length: 1_205 }, (_, index) => index + 1);
    const calls: Array<[number, number]> = [];

    const result = await collectPaginated(async (skip, limit) => {
        calls.push([skip, limit]);
        return source.slice(skip, skip + limit);
    });

    assert.deepEqual(result, source);
    assert.deepEqual(calls, [[0, 500], [500, 500], [1000, 500]]);
});

test("pagination stops after the first partial page", async () => {
    let calls = 0;
    const result = await collectPaginated(async () => {
        calls += 1;
        return [1, 2];
    }, 500);

    assert.deepEqual(result, [1, 2]);
    assert.equal(calls, 1);
});
