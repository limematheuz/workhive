import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    REALTIME_TOPICS,
    getRealtimeConnectionState,
    isRealtimeTopic,
    setRealtimeConnectionState,
} from "./realtime-events.ts";

test("real-time invalidations use an explicit allowlist", () => {
    assert.equal(isRealtimeTopic("tasks"), true);
    assert.equal(isRealtimeTopic("notifications"), true);
    assert.equal(isRealtimeTopic("company_id"), false);
    assert.equal(isRealtimeTopic("unknown"), false);
    assert.deepEqual(REALTIME_TOPICS.includes("calendar"), true);
});

test("real-time connection state remains safe without a browser global", () => {
    setRealtimeConnectionState(false);
    assert.equal(getRealtimeConnectionState(), false);
    setRealtimeConnectionState(true);
    assert.equal(getRealtimeConnectionState(), true);
    setRealtimeConnectionState(false);
});

test("notification refreshes stay scoped to their invalidation topic", () => {
    const source = readFileSync(
        new URL("../components/dashboard/notifications/useNotifications.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /\["tasks"\][\s\S]*loadTaskNotifications/);
    assert.match(source, /\["locations"\][\s\S]*loadLocationNotifications/);
    assert.match(source, /\["reservations"\][\s\S]*loadReservationNotifications/);
    assert.match(source, /\["privacy"\][\s\S]*loadPrivacyNotifications/);
    assert.match(source, /\["notifications"\][\s\S]*loadPersistentNotifications/);
    assert.doesNotMatch(
        source,
        /\["locations", "notifications", "privacy", "reservations", "tasks"\]/,
    );
});

test("dashboard and sidebar keep task refreshes separate from other domains", () => {
    const dashboard = readFileSync(
        new URL("../app/dashboard/page.tsx", import.meta.url),
        "utf8",
    );
    const sidebar = readFileSync(
        new URL("../components/dashboard/Sidebar.tsx", import.meta.url),
        "utf8",
    );

    assert.match(dashboard, /\["tasks"\][\s\S]*loadDashboardTasks/);
    assert.match(dashboard, /\["locations"\][\s\S]*loadDashboardLocations/);
    assert.match(sidebar, /\["tasks", "sidebar"\][\s\S]*refreshPending[\s\S]*refreshTasks/);
    assert.match(sidebar, /\["notifications"\][\s\S]*refreshReports/);
});

test("the event stream reconnects after a temporary proxy failure", () => {
    const hookSource = readFileSync(
        new URL("../hooks/useRealtimeEvents.ts", import.meta.url),
        "utf8",
    );
    const transportSource = readFileSync(
        new URL("./realtime-events.ts", import.meta.url),
        "utf8",
    );

    assert.match(hookSource, /return subscribeToRealtimeEvents/);
    assert.match(transportSource, /INITIAL_RECONNECT_DELAY_MS = 1_000/);
    assert.match(transportSource, /nextSource\.close\(\)/);
    assert.match(transportSource, /nextSource\.removeEventListener\("ready"/);
    assert.match(transportSource, /nextSource\.removeEventListener\("error"/);
    assert.match(transportSource, /window\.setTimeout/);
    assert.match(transportSource, /openStream\(\)/);
});
