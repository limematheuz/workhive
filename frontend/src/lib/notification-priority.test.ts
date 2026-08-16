import assert from "node:assert/strict";
import test from "node:test";

import {
    getPersistentNotificationPriority,
    getTaskNotificationPriority,
} from "./notification-priority.ts";

test("new task notifications are updates while overdue and rejected work are alerts", () => {
    assert.equal(getTaskNotificationPriority("pending", false), "update");
    assert.equal(getTaskNotificationPriority("accepted", true), "alert");
    assert.equal(getTaskNotificationPriority("rejected", false), "alert");
    assert.equal(getTaskNotificationPriority("completed", false), "update");
});

test("payment collection notices are alerts while other persistent updates stay primary", () => {
    assert.equal(getPersistentNotificationPriority("invoice", "invoice.payment_due_soon"), "alert");
    assert.equal(getPersistentNotificationPriority("invoice", "invoice.payment_overdue"), "alert");
    assert.equal(getPersistentNotificationPriority("task_item", "task.reported"), "update");
});
