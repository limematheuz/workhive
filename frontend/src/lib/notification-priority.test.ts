import assert from "node:assert/strict";
import test from "node:test";

import { getTaskNotificationPriority } from "./notification-priority.ts";

test("new task notifications are updates while overdue and rejected work are alerts", () => {
    assert.equal(getTaskNotificationPriority("pending", false), "update");
    assert.equal(getTaskNotificationPriority("accepted", true), "alert");
    assert.equal(getTaskNotificationPriority("rejected", false), "alert");
    assert.equal(getTaskNotificationPriority("completed", false), "update");
});
