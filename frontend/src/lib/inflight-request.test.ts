import assert from "node:assert/strict";
import test from "node:test";

import { createInflightRequestDeduper } from "./inflight-request.ts";

test("identical requests share only the active promise", async () => {
    const dedupe = createInflightRequestDeduper();
    let calls = 0;
    let release!: (value: number) => void;
    const pending = new Promise<number>((resolve) => {
        release = resolve;
    });
    const request = () => {
        calls += 1;
        return pending;
    };

    const first = dedupe("tasks:user:2", request);
    const second = dedupe("tasks:user:2", request);

    assert.equal(calls, 1);
    assert.equal(first, second);
    release(42);
    assert.equal(await first, 42);
    assert.equal(await second, 42);

    const third = dedupe("tasks:user:2", async () => {
        calls += 1;
        return 43;
    });
    assert.equal(await third, 43);
    assert.equal(calls, 2);
});

test("different request keys never share results", async () => {
    const dedupe = createInflightRequestDeduper();
    let calls = 0;

    const [first, second] = await Promise.all([
        dedupe("tasks:user:2", async () => ++calls),
        dedupe("tasks:user:5", async () => ++calls),
    ]);

    assert.deepEqual([first, second], [1, 2]);
});
