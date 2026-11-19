import assert from "node:assert/strict";
import test from "node:test";
import {
    canQueryManagementTaskFeed,
    canQueryReservationNotificationFeed,
} from "./notification-feed-access.ts";

test("Operaciones profile on worker access class queries management task and reservation feeds", () => {
    assert.equal(canQueryManagementTaskFeed(true, "viewer"), true);
    assert.equal(canQueryReservationNotificationFeed(true, true, true, "viewer"), true);
    assert.equal(canQueryReservationNotificationFeed(true, false, true, "viewer"), false);
});

test("read-only or empty profiles on manager access class do not query management or reservation feeds", () => {
    assert.equal(canQueryManagementTaskFeed(false, "manager"), false);
    assert.equal(canQueryReservationNotificationFeed(true, true, false, "manager"), false);
    assert.equal(canQueryReservationNotificationFeed(true, false, false, "manager"), false);
});

test("legacy callers without explicit capability fall back to manager role", () => {
    assert.equal(canQueryManagementTaskFeed(undefined, "admin"), true);
    assert.equal(canQueryManagementTaskFeed(undefined, "manager"), true);
    assert.equal(canQueryManagementTaskFeed(undefined, "viewer"), false);
    assert.equal(canQueryReservationNotificationFeed(true, true, undefined, "manager"), true);
    assert.equal(canQueryReservationNotificationFeed(true, true, undefined, "viewer"), false);
    assert.equal(canQueryReservationNotificationFeed(false, true, true, "admin"), false);
});
