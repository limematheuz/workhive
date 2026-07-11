import assert from "node:assert/strict";
import test from "node:test";

import { buildCompanyTaskStats } from "./operations-analytics.ts";
import type { TaskItem } from "../types/user.ts";

function makeTask(overrides: Partial<TaskItem>): TaskItem {
    return {
        id: 1,
        title: "Task",
        location_id: 1,
        user_id: null,
        status: "pending",
        priority: "medium",
        unit: "service",
        is_invoiced: false,
        created_at: "2026-06-10T10:00:00",
        updated_at: "2026-06-10T10:00:00",
        ...overrides,
    };
}

test("operations chart uses completion and deadline dates", () => {
    const stats = buildCompanyTaskStats(
        [
            makeTask({ id: 1, status: "completed", date_done: "2026-07-03T10:00:00" }),
            makeTask({ id: 2, status: "pending", due_at: "2026-07-04T10:00:00" }),
            makeTask({ id: 3, status: "pending", created_at: "2026-07-05T10:00:00", due_at: "2026-07-20T10:00:00" }),
            makeTask({ id: 4, status: "requested", created_at: "2026-07-06T10:00:00" }),
            makeTask({ id: 5, status: "rejected", created_at: "2026-07-06T10:00:00" }),
        ],
        "es",
        new Date("2026-07-10T12:00:00"),
    );
    const july = 5;

    assert.equal(stats.completed[july], 1);
    assert.equal(stats.overdue[july], 1);
    assert.equal(stats.pending[july], 1);
    assert.equal(stats.requested[july], 1);
    assert.equal(stats.rejected[july], 1);
    assert.equal(stats.total[july], 5);
    assert.equal(
        stats.completed[july] + stats.overdue[july] + stats.pending[july] + stats.requested[july] + stats.rejected[july],
        stats.total[july],
    );
});
