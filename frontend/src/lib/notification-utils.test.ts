import assert from "node:assert/strict";
import test from "node:test";

import {
    getCollaborationNotificationKey,
    addDismissedNotificationKey,
    getDismissedNotificationKeys,
    getPrivacyRequestNotificationKey,
    getReservationNotificationKey,
    getTaskNotificationKey,
    getUpcomingArrivalNotificationKey,
    isWithinLastDays,
} from "../components/dashboard/notifications/notification-utils.ts";


test("notification keys include entity and state so new events reappear", () => {
    assert.equal(getTaskNotificationKey({ id: 7, status: "accepted" } as never), "task:7:accepted");
    assert.equal(
        getCollaborationNotificationKey({ id: 8, status: "pending" } as never),
        "collaboration:8:pending",
    );
    assert.equal(
        getReservationNotificationKey({ id: 9, status: "cancelled" } as never),
        "reservation:9:cancelled",
    );
    assert.equal(
        getUpcomingArrivalNotificationKey({ id: 9, check_in_at: "2026-07-14T10:00:00Z" } as never),
        "reservation:9:arrival:2026-07-14T10:00:00Z",
    );
    assert.equal(
        getPrivacyRequestNotificationKey({ id: 10, status: "processing" } as never),
        "privacy:10:processing",
    );
});

test("notification recency and server rendering defaults are safe", () => {
    const now = Date.parse("2026-07-13T12:00:00Z");
    assert.equal(isWithinLastDays("2026-07-12T12:00:00Z", 2, now), true);
    assert.equal(isWithinLastDays("2026-07-10T12:00:00Z", 2, now), false);
    assert.deepEqual(getDismissedNotificationKeys(1), []);
});

test("opening a task only dismisses its current notification state once", () => {
    const pendingTaskKey = getTaskNotificationKey({ id: 17, status: "pending" } as never);

    assert.deepEqual(
        addDismissedNotificationKey(["task:5:pending"], pendingTaskKey),
        ["task:5:pending", "task:17:pending"],
    );
    assert.deepEqual(
        addDismissedNotificationKey([pendingTaskKey], pendingTaskKey),
        [pendingTaskKey],
    );
});
