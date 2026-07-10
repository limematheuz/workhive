import assert from "node:assert/strict";
import test from "node:test";

import {
    cleanChecklistDescription,
    getUserChecklistItems,
    getUserTaskStatus,
    isTaskAssignedToUser,
    parseTaskAssigneeIds,
} from "./format.ts";

test("hidden task assignees assign one checklist to multiple workers without visible metadata", () => {
    const description = "<!-- workhive_assignees:1,2,3 -->\n- [ ] Limpiar suelo";
    const task = {
        description,
        user_id: null,
        status: "pending",
    };

    assert.deepEqual(parseTaskAssigneeIds(description), [1, 2, 3]);
    assert.equal(isTaskAssignedToUser(task, 2), true);
    assert.equal(getUserChecklistItems(task, 2).length, 1);
    assert.equal(cleanChecklistDescription(description), "Limpiar suelo");
});

test("global completed status wins over stale worker checklist status", () => {
    const task = {
        description: "- [ ] Limpiar suelo (@2:Andrea:accepted)",
        user_id: null,
        status: "completed",
    };

    assert.equal(getUserTaskStatus(task, 2), "completed");
});
