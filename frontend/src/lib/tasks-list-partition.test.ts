import assert from "node:assert/strict";
import test from "node:test";

import {
    isTaskFinished,
    partitionTasksForGeneralList,
    sortTasksForGeneralList,
} from "../components/tasks/tasksListUtils.ts";

const task = (
    id: number,
    status: string,
    is_invoiced = false,
) => ({ id, status, is_invoiced });

test("isTaskFinished treats completed and invoiced tasks as finished", () => {
    assert.equal(isTaskFinished(task(1, "pending")), false);
    assert.equal(isTaskFinished(task(2, "progress")), false);
    assert.equal(isTaskFinished(task(3, "completed")), true);
    assert.equal(isTaskFinished(task(4, "pending", true)), true);
});

test("partitionTasksForGeneralList keeps completed out of the active group", () => {
    const partitioned = partitionTasksForGeneralList([
        task(10, "completed"),
        task(11, "pending"),
        task(12, "progress"),
        task(13, "review"),
        task(14, "completed", true),
    ]);

    assert.deepEqual(partitioned.active.map(item => item.id), [11, 12, 13]);
    assert.deepEqual(partitioned.completed.map(item => item.id), [10, 14]);
});

test("sortTasksForGeneralList orders by workflow weight then newest id", () => {
    const sorted = sortTasksForGeneralList([
        task(3, "completed"),
        task(2, "pending"),
        task(5, "progress"),
        task(4, "pending"),
    ]);
    assert.deepEqual(sorted.map(item => item.id), [4, 2, 5, 3]);
});
