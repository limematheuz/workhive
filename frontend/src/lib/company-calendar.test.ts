import test from "node:test";
import assert from "node:assert/strict";

import {
    getTaskCalendarDurationMinutes,
    getMonthCalendarDays,
    getTaskCalendarDate,
    getTaskCalendarRange,
    startOfLocalDay,
} from "./company-calendar.ts";
import type { TaskItem } from "@/types/user";


test("month calendar starts on Monday and always contains six weeks", () => {
    const days = getMonthCalendarDays(new Date(2026, 5, 15));

    assert.equal(days.length, 42);
    assert.equal(days[0].getDay(), 1);
    assert.equal(days[0].getFullYear(), 2026);
    assert.equal(days[0].getMonth(), 5);
    assert.equal(days[0].getDate(), 1);
});

test("task calendar date prioritizes scheduled start over due date", () => {
    const task = {
        scheduled_start_at: "2026-06-15T08:00:00Z",
        due_at: "2026-06-15T10:00:00Z",
    } as TaskItem;

    assert.equal(
        getTaskCalendarDate(task)?.toISOString(),
        "2026-06-15T08:00:00.000Z",
    );
});

test("task calendar range keeps exact start and due time", () => {
    const task = {
        scheduled_start_at: "2026-06-15T08:15:00Z",
        due_at: "2026-06-15T10:45:00Z",
    } as TaskItem;

    const range = getTaskCalendarRange(task);

    assert.equal(range?.start.toISOString(), "2026-06-15T08:15:00.000Z");
    assert.equal(range?.end.toISOString(), "2026-06-15T10:45:00.000Z");
    assert.equal(getTaskCalendarDurationMinutes(task), 150);
});

test("task calendar range defaults to one hour when due date is missing", () => {
    const task = {
        scheduled_start_at: "2026-06-15T08:00:00Z",
        due_at: null,
    } as TaskItem;

    assert.equal(
        getTaskCalendarRange(task)?.end.toISOString(),
        "2026-06-15T09:00:00.000Z",
    );
});

test("legacy UTC-midnight task stays on its selected local calendar day", () => {
    const task = {
        scheduled_start_at: "2026-07-11T00:00:00Z",
        due_at: null,
    } as TaskItem;

    const calendarDate = getTaskCalendarDate(task);

    assert.ok(calendarDate);
    assert.deepEqual(
        [calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate()],
        [2026, 6, 11],
    );
});

test("start of local day clears time fields", () => {
    const value = startOfLocalDay(new Date(2026, 5, 15, 18, 45, 20));

    assert.equal(value.getHours(), 0);
    assert.equal(value.getMinutes(), 0);
    assert.equal(value.getSeconds(), 0);
});
