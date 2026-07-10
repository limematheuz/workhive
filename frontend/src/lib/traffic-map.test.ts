import assert from "node:assert/strict";
import test from "node:test";

import {
    MAP_HEIGHT,
    MAP_WIDTH,
    clampMapTransform,
    groupTrafficMapPoints,
    isValidTrafficMapPoint,
    type TrafficMapPoint,
} from "./traffic-map.ts";

function point(overrides: Partial<TrafficMapPoint>): TrafficMapPoint {
    return {
        id: "a",
        lat: 41.39,
        lng: 2.17,
        label: "/dashboard",
        location: "Barcelona, ES",
        ...overrides,
    };
}

test("traffic map validates finite world coordinates only", () => {
    assert.equal(isValidTrafficMapPoint(point({})), true);
    assert.equal(isValidTrafficMapPoint(point({ lat: 91 })), false);
    assert.equal(isValidTrafficMapPoint(point({ lat: -91 })), false);
    assert.equal(isValidTrafficMapPoint(point({ lng: 181 })), false);
    assert.equal(isValidTrafficMapPoint(point({ lng: Number.NaN })), false);
});

test("traffic map groups valid points by location and averages coordinates", () => {
    const grouped = groupTrafficMapPoints([
        point({ id: "a", lat: 40, lng: 2, location: "Spain" }),
        point({ id: "b", lat: 42, lng: 4, location: "Spain" }),
        point({ id: "bad", lat: 120, lng: 2, location: "Bad" }),
    ]);

    assert.deepEqual(grouped, [{
        id: "a-b",
        lat: 41,
        lng: 3,
        count: 2,
        location: "Spain",
    }]);
});

test("traffic map groups unknown locations by rounded coordinates", () => {
    assert.deepEqual(
        groupTrafficMapPoints([
            point({ id: "a", lat: 10.123, lng: 20.126, location: "-" }),
            point({ id: "b", lat: 10.124, lng: 20.124, location: "-" }),
        ]).map(group => group.location),
        ["10.12,20.13", "10.12,20.12"],
    );
});

test("traffic map transform clamps scale and pan to visible world", () => {
    assert.deepEqual(clampMapTransform({ x: 10, y: 20, scale: 0.1 }), {
        x: 0,
        y: 0,
        scale: 1,
    });

    assert.deepEqual(clampMapTransform({ x: -9999, y: -9999, scale: 10 }), {
        x: -MAP_WIDTH * 4,
        y: -MAP_HEIGHT * 4,
        scale: 5,
    });
});
