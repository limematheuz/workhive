import assert from "node:assert/strict";
import test from "node:test";

import {
    filterTasksForGeneralList,
    isTaskFinished,
    paginateTaskListPage,
    partitionTasksForGeneralList,
    sortTasksForGeneralList,
} from "../components/tasks/tasksListUtils.ts";

const task = (
    id: number,
    status: string,
    is_invoiced = false,
    extras: Partial<{
        title: string;
        description: string;
        created_at: string;
        due_at: string | null;
        location_id: number;
        user_id: number | null;
        priority: string;
    }> = {},
) => ({
    id,
    status,
    is_invoiced,
    title: extras.title ?? `Task ${id}`,
    description: extras.description ?? "",
    created_at: extras.created_at ?? "2026-07-14T12:00:00Z",
    due_at: extras.due_at ?? null,
    scheduled_start_at: null,
    location_id: extras.location_id ?? 1,
    user_id: extras.user_id ?? null,
    priority: extras.priority ?? "low",
});

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

test("filterTasksForGeneralList applies search date and priority filters", () => {
    const tasks = [
        task(1, "pending", false, {
            title: "Limpieza cocina",
            due_at: "2026-07-20T10:00:00Z",
            priority: "high",
            location_id: 7,
        }),
        task(2, "progress", false, {
            title: "Revisión",
            due_at: "2026-07-01T10:00:00Z",
            priority: "low",
            location_id: 8,
        }),
    ];
    const now = new Date("2026-07-14T00:00:00Z");
    const filtered = filterTasksForGeneralList(tasks, {
        query: "casa",
        dateScope: "UPCOMING",
        priority: "high",
        now,
        getLocationName: id => (id === 7 ? "Casa Javier" : "Otro"),
        getAssigneeName: () => "Sin asignar",
    });
    assert.deepEqual(filtered.map(item => item.id), [1]);
});

test("paginateTaskListPage clamps pages for compact list browsing", () => {
    const items = Array.from({ length: 45 }, (_, index) => task(index + 1, "pending"));
    const first = paginateTaskListPage(items, 1, 20);
    const last = paginateTaskListPage(items, 99, 20);
    assert.equal(first.totalPages, 3);
    assert.equal(first.pageItems.length, 20);
    assert.equal(last.safePage, 3);
    assert.equal(last.pageItems.length, 5);
});
