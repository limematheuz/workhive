import assert from "node:assert/strict";
import test from "node:test";

import {
    ALL_WORKERS_VALUE,
    buildTaskPlanningDate,
    buildChecklistDescription,
    getDefaultAssignmentIds,
    getDefaultTaskDate,
    getTaskAssigneeId,
    getTaskCreationSchedule,
} from "../domain/tasks/task-create.ts";
import {
    getOverviewTabForDate,
    isTaskPlanningDateChangeToPast,
    isTaskPlanningDateBeforeToday,
    isTaskDateOnlyValue,
    toTaskPlanningDateInput,
    toTaskPlanningTimeInput,
} from "../domain/tasks/task-schedule.ts";
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

test("date-only task stays on the selected day without inventing a start hour", () => {
    const localMorning = new Date(2026, 6, 13, 9, 0, 0);
    const plannedAt = buildTaskPlanningDate("2026-07-13");

    assert.equal(getDefaultTaskDate(localMorning), "2026-07-13");
    assert.equal(plannedAt, "2026-07-13T00:00:00.000Z");
    assert.equal(isTaskDateOnlyValue(plannedAt), true);
    assert.equal(isTaskDateOnlyValue("2026-07-13T00:00:00+00:00"), true);
    assert.equal(isTaskDateOnlyValue(new Date(2026, 6, 13, 23, 59, 59, 999).toISOString()), true);
    assert.equal(isTaskDateOnlyValue(new Date(2026, 6, 13, 23, 59).toISOString()), false);
    assert.equal(isTaskDateOnlyValue(new Date(2026, 6, 13, 10, 59, 59, 999).toISOString()), false);
    assert.equal(toTaskPlanningDateInput(plannedAt), "2026-07-13");
    assert.equal(toTaskPlanningTimeInput(plannedAt), "");
    assert.equal(toTaskPlanningTimeInput("2026-07-13T09:30:00.000Z") !== "", true);
    assert.equal(getOverviewTabForDate(plannedAt, localMorning), "hoy");
    assert.equal(
        getOverviewTabForDate("2026-07-13T00:00:00.000Z", localMorning),
        "hoy",
    );
    assert.equal(buildTaskPlanningDate("2026-02-31"), undefined);
});

test("task planning rejects previous days but allows today and future days", () => {
    const now = new Date(2026, 6, 13, 10, 5, 0);

    assert.equal(isTaskPlanningDateBeforeToday("2026-07-11", now), true);
    assert.equal(isTaskPlanningDateBeforeToday("2026-07-13", now), false);
    assert.equal(isTaskPlanningDateBeforeToday("2026-07-14", now), false);
    assert.equal(isTaskPlanningDateBeforeToday("", now), false);
});

test("historical task metadata can be edited without backdating another task", () => {
    const now = new Date(2026, 6, 13, 10, 5, 0);

    assert.equal(
        isTaskPlanningDateChangeToPast("2026-07-11", "2026-07-11", now),
        false,
    );
    assert.equal(
        isTaskPlanningDateChangeToPast("2026-07-13", "2026-07-11", now),
        true,
    );
    assert.equal(
        isTaskPlanningDateChangeToPast("2026-07-13", "2026-07-14", now),
        false,
    );
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
