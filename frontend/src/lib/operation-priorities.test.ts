import test from "node:test";
import assert from "node:assert/strict";
import { buildAttentionQueue, operationForecast, taskScheduleConflicts } from "../domain/tasks/operation-priorities.ts";
import type { TaskItem } from "../types/user.ts";

const now = new Date(2026, 10, 19, 12);
const task = (id: number, data: Partial<TaskItem> = {}) => ({ id, title: `Trabajo ${id}`, status: "pending", location_id: 1, assignments: [], ...data }) as TaskItem;

test("attention counts a late unassigned job once and keeps both reasons", () => {
    const rows = buildAttentionQueue([task(1, { scheduled_start_at: new Date(2026, 10, 19, 8).toISOString() }), task(2)], now);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].task.id, 1);
    assert.deepEqual(rows[0].reasons, ["late", "unassigned"]);
    assert.deepEqual(rows[1].reasons, ["unscheduled"]);
    assert.equal(buildAttentionQueue([task(1, { status: "completed", is_invoiced: true })], now).length, 0);
});

test("forecast covers seven real days and excludes creation-only and cancelled records", () => {
    const rows = operationForecast([task(1, { created_at: now.toISOString() }), task(2, { scheduled_start_at: new Date(2026, 10, 20, 8).toISOString() }), task(3, { status: "cancelled", scheduled_start_at: now.toISOString() })], now);
    assert.equal(rows.length, 7);
    assert.equal(rows.reduce((sum, day) => sum + day.tasks.length, 0), 1);
    assert.deepEqual(rows[1].tasks.map(row => row.id), [2]);
    assert.equal(rows[1].unassigned, 1);
});

test("conflicts need overlapping timed intervals and the same accepted worker", () => {
    const timed = (id: number, start: number, end: number, worker = 7) => task(id, { user_id: worker, scheduled_start_at: new Date(2026, 10, 19, start).toISOString(), due_at: new Date(2026, 10, 19, end).toISOString() });
    const rows = taskScheduleConflicts([timed(1, 8, 10), timed(2, 9, 11), timed(3, 10, 12), timed(4, 9, 11, 8), task(5, { user_id: 7, scheduled_start_at: "2026-11-19", due_at: null })]);
    assert.deepEqual(rows.map(row => [row.first.id, row.second.id, row.workerIds]), [[1, 2, [7]], [2, 3, [7]]]);
    assert.equal(taskScheduleConflicts([timed(1, 8, 10), timed(2, 9, 11), timed(3, 9, 11)]).length, 3);
});
