import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationDestination } from "./notification-destination.ts";

test("task notices stay in the worker application and preserve office destinations", () => {
    const notice = { entity_type: "task_item", entity_id: 42, href: "/dashboard?taskId=42" };
    assert.equal(getNotificationDestination(notice, true), "/worker/jobs?taskId=42");
    assert.equal(getNotificationDestination(notice, false), notice.href);
    assert.equal(getNotificationDestination({ ...notice, entity_type: "task_report" }, true), notice.href);
    for (const entity_id of [null, 0, -1, NaN, Infinity, 1.5]) {
        assert.equal(getNotificationDestination({ ...notice, entity_id }, true), notice.href);
    }
    assert.equal(getNotificationDestination({ href: "//outside.example" }, true), "/dashboard");
});
