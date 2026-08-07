import assert from "node:assert/strict";
import test from "node:test";

import {
    countOperationalPendingTasks,
    getOperationalTaskStatus,
} from "./operational-task-count.ts";
import type { TaskItem } from "../types/user.ts";

function task(overrides: Partial<TaskItem>): TaskItem {
    return {
        id: 1,
        title: "Limpieza",
        unit: "servicio",
        location_id: 1,
        user_id: 7,
        status: "pending",
        priority: "medium",
        is_invoiced: false,
        created_at: "2026-08-05T09:00:00Z",
        updated_at: "2026-08-05T09:00:00Z",
        ...overrides,
    };
}

test("sidebar operational count matches TODO and excludes non-operational tasks", () => {
    const tasks = [
        task({ id: 1, status: "pending" }),
        task({ id: 2, status: "accepted" }),
        task({ id: 3, status: "progress" }),
        task({ id: 4, status: "completed" }),
        task({ id: 5, status: "requested" }),
        task({ id: 6, status: "rejected" }),
    ];

    assert.equal(countOperationalPendingTasks(tasks, 7, true), 3);
});

test("worker count uses the worker assignment status, not a stale global status", () => {
    const tasks = [
        task({
            id: 1,
            status: "accepted",
            assignments: [{ user_id: 7, user_name: "Trabajadora", status: "completed", source: "direct" }],
        }),
        task({
            id: 2,
            status: "accepted",
            assignments: [{ user_id: 7, user_name: "Trabajadora", status: "pending", source: "direct" }],
        }),
    ];

    assert.equal(countOperationalPendingTasks(tasks, 7, false), 1);
});

test("a fully answered checklist is resolved even during a stale task-status refresh", () => {
    const staleCompletedTask = task({
        status: "progress",
        checklist_items: [
            { id: 11, position: 1, text: "Suelo", completed: true, assignments: [] },
            { id: 12, position: 2, text: "Baño", completed: true, assignments: [] },
        ],
    });

    assert.equal(getOperationalTaskStatus(staleCompletedTask, 7, true), "completed");
    assert.equal(countOperationalPendingTasks([staleCompletedTask], 7, true), 0);
});
