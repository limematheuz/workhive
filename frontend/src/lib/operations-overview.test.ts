import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationsOverview, groupOverviewLocations, overviewRange, taskIsLate, taskWorkers } from "../domain/tasks/operations-overview.ts";
import type { TaskItem } from "../types/user.ts";

const now = new Date(2026, 10, 14, 12);
const task = (id: number, fields: Partial<TaskItem> = {}): TaskItem => ({
    id, title: `Task ${id}`, unit: "unit", location_id: 1, user_id: null, status: "pending", priority: "medium",
    is_invoiced: false, created_at: now.toISOString(), updated_at: now.toISOString(), ...fields,
});
const scheduled = (hour: number) => new Date(2026, 10, 14, hour).toISOString();

test("the daily summary excludes cancelled and unscheduled tasks and never treats creation as scheduling", () => {
    const data = buildOperationsOverview([task(1, { scheduled_start_at: scheduled(9) }), task(2), task(3, { status: "cancelled", scheduled_start_at: scheduled(9) }), task(4, { scheduled_start_at: new Date(2026, 10, 15, 9).toISOString() })], overviewRange("today", "", now), now);
    assert.deepEqual(data.planned.map(item => item.id), [1]);
    assert.deepEqual(data.unscheduled.map(item => item.id), [2]);
    assert.equal(data.late.length, 1);
});
test("workers are unique across direct and checklist assignments and rejected assignments do not provide coverage", () => {
    const first = task(1, { user_id: 5, scheduled_start_at: scheduled(9), assignments: [{ user_id: 5, user_name: "Ana", status: "accepted", source: "all" }, { user_id: 6, user_name: "Luis", status: "accepted", source: "checklist" }] });
    const second = task(2, { scheduled_start_at: scheduled(10), assignments: [{ user_id: 6, user_name: "Luis", status: "rejected", source: "direct" }] });
    const data = buildOperationsOverview([first, second], overviewRange("today", "", now), now);
    assert.equal(taskWorkers(first).length, 2);
    assert.equal(data.team.length, 2);
    assert.deepEqual(data.unassigned.map(item => item.id), [2]);
});
test("date-only tasks are not late during their day and in-progress tasks are not labelled as late starts", () => {
    assert.equal(taskIsLate(task(1, { due_at: "2026-11-14T00:00:00Z" }), now), false);
    assert.equal(taskIsLate(task(2, { scheduled_start_at: scheduled(9), status: "in_progress" }), now), false);
    assert.equal(taskIsLate(task(3, { due_at: "2026-11-13T00:00:00Z" }), now), true);
});
test("progress uses all planned tasks and absent durations remain unknown", () => {
    const data = buildOperationsOverview([task(1, { scheduled_start_at: scheduled(8), due_at: scheduled(10), status: "completed" }), task(2, { due_at: "2026-11-14T00:00:00Z", status: "in_review" })], overviewRange("today", "", now), now);
    assert.equal(data.completion, 50);
    assert.equal(data.review.length, 1);
    assert.equal(data.plannedMinutes, 120);
    assert.equal(data.missingDuration, 1);
});
test("periods have exclusive ends and a week begins on Monday, including across months", () => {
    const week = overviewRange("week", "", new Date(2026, 10, 1, 14));
    assert.equal(week.start.getDay(), 1);
    assert.equal(week.start.getMonth(), 9);
    assert.equal(week.end.getDate(), 2);
    const custom = overviewRange("date", "2026-11-15", now);
    assert.equal(custom.start.getDate(), 15);
    assert.equal(custom.end.getDate(), 16);
});

test("an overnight service appears on both days but planned time is clipped to the selected day", () => {
    const overnight = task(1, { scheduled_start_at: new Date(2026, 10, 13, 23).toISOString(), due_at: scheduled(2) });
    const data = buildOperationsOverview([overnight], overviewRange("today", "", now), now);
    assert.equal(data.planned.length, 1);
    assert.equal(data.plannedMinutes, 120);
});
test("an explicit worker rejection does not count as covered even if the legacy user field is populated", () => {
    assert.equal(taskWorkers(task(1, { user_id: 5, assignments: [{ user_id: 5, user_name: "Ana", status: "rejected", source: "all" }] })).length, 0);
});

test("locations group all their work and show each assigned worker once, preserving uncovered tasks", () => {
    const groups = groupOverviewLocations([
        task(1, { location_id: 10, user_id: 5, status: "completed" }),
        task(2, { location_id: 10, assignments: [{ user_id: 5, user_name: "Ana", status: "accepted", source: "all" }, { user_id: 6, user_name: "Luis", status: "accepted", source: "all" }] }),
        task(3, { location_id: 10 }), task(4, { location_id: 20, user_id: 6 }),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].tasks.length, 3);
    assert.deepEqual([...groups[0].workers], [[5, "Ana"], [6, "Luis"]]);
    assert.equal(groups[0].completed, 1);
    assert.equal(groups[0].unassigned, 1);
});
test("older unfinished work stays visible as a separate alert without inflating today's scheduled total", () => {
    const old = new Date(2026, 10, 13, 9).toISOString();
    const data = buildOperationsOverview([task(1, { scheduled_start_at: old }), task(2, { scheduled_start_at: old, status: "completed" }), task(3, { scheduled_start_at: old, status: "cancelled" }), task(4, { scheduled_start_at: scheduled(9) })], overviewRange("today", "", now), now);
    assert.deepEqual(data.carriedOver.map(item => item.id), [1]);
    assert.deepEqual(data.planned.map(item => item.id), [4]);
});

test("today's attention cohort remains today's when consulting tomorrow's planned work", () => {
    const old = new Date(2026, 10, 13, 9).toISOString();
    const tomorrow = new Date(2026, 10, 15, 9).toISOString();
    const tasks = [task(1, { scheduled_start_at: old }), task(2, { scheduled_start_at: scheduled(9) }), task(3, { scheduled_start_at: tomorrow })];
    const selected = buildOperationsOverview(tasks, overviewRange("tomorrow", "", now), now);
    const attention = buildOperationsOverview(tasks, overviewRange("today", "", now), now);
    assert.deepEqual(selected.planned.map(row => row.id), [3]);
    assert.deepEqual(attention.late.map(row => row.id), [2]);
    assert.deepEqual(attention.carriedOver.map(row => row.id), [1]);
});
