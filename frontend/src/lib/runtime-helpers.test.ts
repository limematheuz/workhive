import assert from "node:assert/strict";
import test from "node:test";

import { POLL_INTERVALS } from "./polling.ts";
import {
    buildExternalTaskOperationalUpdate,
} from "./external-task-update.ts";
import { formatHoursShort } from "./format-hours.ts";
import {
    buildWorkStartMapUrl,
    getCurrentWorkStartLocation,
} from "./work-start-location.ts";

test("poll intervals stay fast and positive for live dashboard surfaces", () => {
    assert.equal(POLL_INTERVALS.dashboard, 1_000);
    assert.equal(POLL_INTERVALS.tasks, 1_000);
    assert.equal(POLL_INTERVALS.notifications, 1_000);
    Object.values(POLL_INTERVALS).forEach((interval) => {
        assert.equal(Number.isInteger(interval), true);
        assert.equal(interval > 0, true);
    });
});

test("external task operational update keeps only collaborator-safe fields", () => {
    assert.deepEqual(
        buildExternalTaskOperationalUpdate({
            description: "",
            scheduledStartAt: "2026-07-05T10:00:00",
            status: "completed",
            dateDone: "2026-07-05T11:00:00",
        }),
        {
            description: null,
            scheduled_start_at: "2026-07-05T10:00:00",
            status: "completed",
            date_done: "2026-07-05T11:00:00",
        },
    );
});

test("formatHoursShort keeps compact time labels", () => {
    assert.equal(formatHoursShort(-1), "0m");
    assert.equal(formatHoursShort(0), "0m");
    assert.equal(formatHoursShort(59), "0m");
    assert.equal(formatHoursShort(3_599), "59m");
    assert.equal(formatHoursShort(3_600), "1h");
    assert.equal(formatHoursShort(5_400), "1h 30m");
});

test("work start map url targets exact coordinates", () => {
    assert.equal(
        buildWorkStartMapUrl(41.1234, 2.4567),
        "https://www.google.com/maps/search/?api=1&query=41.1234,2.4567",
    );
});

test("work start location rejects when geolocation is unavailable", async () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
    });

    await assert.rejects(
        getCurrentWorkStartLocation(),
        /Geolocation is not supported/,
    );

    Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
    });
});

test("work start location resolves coordinates and normalizes invalid accuracy", async () => {
    const originalNavigator = globalThis.navigator;
    const calls: PositionOptions[] = [];
    Object.defineProperty(globalThis, "navigator", {
        value: {
            geolocation: {
                getCurrentPosition: (
                    success: PositionCallback,
                    _error?: PositionErrorCallback | null,
                    options?: PositionOptions,
                ) => {
                    if (options) calls.push(options);
                    success({
                        coords: {
                            latitude: 41.1,
                            longitude: 2.2,
                            accuracy: Number.POSITIVE_INFINITY,
                        } as GeolocationCoordinates,
                    } as GeolocationPosition);
                },
            },
        },
        configurable: true,
    });

    const location = await getCurrentWorkStartLocation();

    assert.deepEqual(location, {
        start_latitude: 41.1,
        start_longitude: 2.2,
        start_accuracy_meters: null,
    });
    assert.deepEqual(calls[0], {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
    });

    Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
    });
});
