import assert from "node:assert/strict";
import test from "node:test";

import {
    getOverviewDateRange,
    getTasksForOverviewTab,
    getTaskScheduleDate,
    isDateInRange,
    sortTasksByOperationalPriority,
    toTaskPlanningDateInput,
    toTaskPlanningTimeInput,
} from "../domain/tasks/task-schedule.ts";
import type { TaskItem } from "../types/user.ts";


function task(
    id: number,
    scheduledStartAt: string,
    priority: TaskItem["priority"],
): TaskItem {
    return {
        id,
        title: `Task ${id}`,
        description: null,
        unit: "service",
        status: "pending",
        priority,
        location_id: 1,
        user_id: null,
        is_invoiced: false,
        created_at: scheduledStartAt,
        updated_at: scheduledStartAt,
        scheduled_start_at: scheduledStartAt,
    };
}

test("kanban keeps every task and sorts priority before planning date", () => {
    const tasks = [
        task(1, "2026-07-15T09:00:00Z", "high"),
        task(2, "2026-07-13T15:00:00Z", "medium"),
        task(3, "2026-07-13T09:00:00Z", "low"),
    ];

    assert.deepEqual(
        sortTasksByOperationalPriority(tasks).map((item) => item.id),
        [1, 2, 3],
    );
    assert.equal(tasks.length, 3);
});

test("same-date kanban tasks put urgent priority first without mutating input", () => {
    const tasks = [
        task(1, "2026-07-13T09:00:00Z", "low"),
        task(2, "2026-07-13T09:00:00Z", "high"),
        task(3, "2026-07-13T09:00:00Z", "medium"),
    ];

    assert.deepEqual(
        sortTasksByOperationalPriority(tasks).map((item) => item.id),
        [2, 3, 1],
    );
    assert.deepEqual(tasks.map((item) => item.id), [1, 2, 3]);
});

test("legacy UTC-midnight task from July 13 is visible in the July 13 today tab", () => {
    const legacyTask = {
        ...task(4, "2026-07-13T00:00:00.000Z", "high"),
        scheduled_start_at: null,
    };
    const localMorning = new Date(2026, 6, 13, 9, 51, 0);

    assert.equal(
        isDateInRange(
            getTaskScheduleDate(legacyTask),
            getOverviewDateRange("hoy", localMorning),
        ),
        true,
    );
});

test("UTC-midnight scheduled dates preserve their calendar day in dashboard tabs", () => {
    const todayTask = task(5, "2026-07-13T00:00:00.000Z", "high");
    const tomorrowTask = task(6, "2026-07-14T00:00:00.000Z", "low");
    const localMorning = new Date(2026, 6, 13, 10, 5, 0);
    const todayRange = getOverviewDateRange("hoy", localMorning);
    const tomorrowRange = getOverviewDateRange("manana", localMorning);

    assert.equal(isDateInRange(getTaskScheduleDate(todayTask), todayRange), true);
    assert.equal(isDateInRange(getTaskScheduleDate(todayTask), tomorrowRange), false);
    assert.equal(isDateInRange(getTaskScheduleDate(tomorrowTask), todayRange), false);
    assert.equal(isDateInRange(getTaskScheduleDate(tomorrowTask), tomorrowRange), true);

    const parsedToday = getTaskScheduleDate(todayTask);
    assert.ok(parsedToday);
    assert.deepEqual(
        [parsedToday.getFullYear(), parsedToday.getMonth(), parsedToday.getDate(), parsedToday.getHours()],
        [2026, 6, 13, 23],
    );
});

test("kanban puts a later high-priority task above an earlier low-priority task", () => {
    const lowToday = task(7, "2026-07-13T12:00:00Z", "low");
    const highTomorrow = task(8, "2026-07-14T12:00:00Z", "high");

    assert.deepEqual(
        sortTasksByOperationalPriority([lowToday, highTomorrow]).map((item) => item.id),
        [8, 7],
    );
});

test("kanban sorts dates from earliest to latest inside the same priority", () => {
    const laterHigh = task(13, "2026-07-15T12:00:00Z", "high");
    const earlierHigh = task(14, "2026-07-13T12:00:00Z", "high");

    assert.deepEqual(
        sortTasksByOperationalPriority([laterHigh, earlierHigh]).map(({ id }) => id),
        [14, 13],
    );
});

test("date-only due dates use the same local-day compatibility as scheduled dates", () => {
    const dueOnly = {
        ...task(15, "2026-07-10T10:00:00Z", "medium"),
        scheduled_start_at: null,
        due_at: "2026-07-13T00:00:00Z",
    };
    const planningDate = getTaskScheduleDate(dueOnly);

    assert.ok(planningDate);
    assert.deepEqual(
        [planningDate.getFullYear(), planningDate.getMonth(), planningDate.getDate(), planningDate.getHours()],
        [2026, 6, 13, 23],
    );
});

test("task editor inputs preserve legacy date-only values without a timezone shift", () => {
    const value = "2026-07-11T00:00:00Z";

    assert.equal(toTaskPlanningDateInput(value), "2026-07-11");
    assert.equal(toTaskPlanningTimeInput(value), "12:00");
});

test("dashboard tab counts and rendered tasks come from the same calendar-day classification", () => {
    const todayTask = task(9, "2026-07-13T00:00:00Z", "high");
    const tomorrowTask = task(10, "2026-07-14T00:00:00Z", "low");
    const laterTask = task(11, "2026-07-22T00:00:00Z", "medium");
    const now = new Date(2026, 6, 13, 10, 5, 0);
    const tasks = [tomorrowTask, laterTask, todayTask];

    assert.deepEqual(getTasksForOverviewTab(tasks, "hoy", now).map(({ id }) => id), [9]);
    assert.deepEqual(getTasksForOverviewTab(tasks, "manana", now).map(({ id }) => id), [10]);
    assert.deepEqual(getTasksForOverviewTab(tasks, "semana", now).map(({ id }) => id), [10, 9]);
    assert.deepEqual(getTasksForOverviewTab(tasks, "todo", now).map(({ id }) => id), [10, 11, 9]);
});

test("dashboard excludes malformed planning dates instead of leaking them into today", () => {
    const malformed = task(12, "not-a-date", "high");
    const now = new Date(2026, 6, 13, 10, 5, 0);

    assert.deepEqual(getTasksForOverviewTab([malformed], "hoy", now), []);
    assert.deepEqual(getTasksForOverviewTab([malformed], "todo", now), [malformed]);
});
