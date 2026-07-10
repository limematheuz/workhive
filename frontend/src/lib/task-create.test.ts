import assert from "node:assert/strict";
import test from "node:test";

import {
    ALL_WORKERS_VALUE,
    buildChecklistDescription,
    getDefaultAssignmentIds,
    getTaskAssigneeId,
    getTaskCreationSchedule,
} from "../domain/tasks/task-create.ts";
import type { Reservation } from "../types/reservation.ts";
import type { User } from "../types/user.ts";

const workers = [
    {
        id: 1,
        email: "one@workhive.test",
        full_name: "One Worker",
        role_id: 4,
        role: { id: 4, name: "viewer" },
    },
    {
        id: 2,
        email: "two@workhive.test",
        full_name: "Two Worker",
        role_id: 4,
        role: { id: 4, name: "viewer" },
    },
] satisfies User[];

test("task assignee id ignores all-workers sentinel", () => {
    assert.equal(getTaskAssigneeId(ALL_WORKERS_VALUE), null);
    assert.equal(getTaskAssigneeId("2"), 2);
});

test("default assignment ids expand all workers", () => {
    assert.deepEqual(getDefaultAssignmentIds(ALL_WORKERS_VALUE, workers), ["1", "2"]);
    assert.deepEqual(getDefaultAssignmentIds("1", workers), ["1"]);
});

test("turnover on same day becomes high priority", () => {
    const schedule = getTaskCreationSchedule(
        { check_out_at: "2026-06-30T10:00:00Z" } as Reservation,
        { check_in_at: "2026-06-30T16:00:00Z" } as Reservation,
    );
    assert.equal(schedule.serviceContext, "turnover");
    assert.equal(schedule.priority, "high");
});

test("checklist description keeps hidden all-worker metadata", () => {
    const result = buildChecklistDescription({
        description: "- [ ] Cocina\n- [ ] Baño",
        templateTaskId: 10,
        users: workers,
        selectedUserId: ALL_WORKERS_VALUE,
        fixedChecklistAssignments: {},
    });
    assert.equal(
        result,
        "<!-- workhive_assignees:1,2 -->\n- [ ] Cocina\n- [ ] Baño",
    );
});

test("checklist description assigns selected worker by line", () => {
    const result = buildChecklistDescription({
        description: "- [ ] Cocina",
        templateTaskId: 10,
        users: workers,
        selectedUserId: "",
        fixedChecklistAssignments: { "10-0": "2" },
    });
    assert.equal(result, "- [ ] Cocina (@2:Two Worker)");
});
