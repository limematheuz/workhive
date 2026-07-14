import assert from "node:assert/strict";
import test from "node:test";

import {
    countUnreadTaskReportNotifications,
    countUnreadTaskNotifications,
    getPersistentNotificationHref,
    getPersistentTaskNotificationIds,
} from "./task-reporting.ts";


test("persistent task notification opens linked task tab", () => {
    assert.equal(getPersistentNotificationHref({ href: "/dashboard?taskId=42" }), "/dashboard?taskId=42");
    assert.equal(getPersistentNotificationHref({ href: "https://evil.test" }), "/dashboard");
    assert.equal(getPersistentNotificationHref({ href: "//evil.test/task" }), "/dashboard");
    assert.equal(getPersistentNotificationHref({ href: "/\\evil.test/task" }), "/dashboard");
});

test("sidebar task badge counts only unread task notifications", () => {
    assert.equal(countUnreadTaskNotifications([
        { entity_type: "task_item", read_at: null },
        { entity_type: "task_report", read_at: null },
        { entity_type: "task_item", read_at: "2026-07-13T01:00:00Z" },
        { entity_type: "reservation", read_at: null },
        { entity_type: null, read_at: null },
    ]), 1);
});

test("report badge counts only unread task report notifications", () => {
    assert.equal(countUnreadTaskReportNotifications([
        { entity_type: "task_report", read_at: null },
        { entity_type: "task_report", read_at: "2026-07-14T10:00:00Z" },
        { entity_type: "task_item", read_at: null },
        { entity_type: null, read_at: null },
    ]), 1);
});

test("overview and tasks share the same unread task alert count source", () => {
    const notifications = [
        { entity_type: "task_item", read_at: null },
        { entity_type: "task_item", read_at: null },
        { entity_type: "reservation", read_at: null },
    ];
    const sharedCount = countUnreadTaskNotifications(notifications);
    assert.equal(sharedCount, 2);
    assert.equal(countUnreadTaskNotifications(notifications), sharedCount);
});

test("persistent assignment notifications de-duplicate legacy task alerts", () => {
    assert.deepEqual(
        [...getPersistentTaskNotificationIds([
            { entity_type: "task_item", entity_id: 42 },
            { entity_type: "task_item", entity_id: 42 },
            { entity_type: "task_report", entity_id: 42 },
            { entity_type: "reservation", entity_id: 42 },
            { entity_type: "task_item", entity_id: null },
        ])],
        [42],
    );
});
