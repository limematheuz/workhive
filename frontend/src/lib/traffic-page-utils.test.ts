import assert from "node:assert/strict";
import test from "node:test";

import {
    fallbackTraffic,
    getAuthenticatedTrafficMapPoints,
    getDeviceKind,
    getDeviceLabel,
} from "./traffic/traffic-page-utils.ts";

const traffic = fallbackTraffic.es;

test("traffic device classification distinguishes mobile, tablet, desktop and unknown browsers", () => {
    assert.equal(getDeviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "mobile");
    assert.equal(getDeviceKind("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), "tablet");
    assert.equal(getDeviceKind("Mozilla/5.0 (Linux; Android 14; SM-X710)"), "tablet");
    assert.equal(getDeviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "desktop");
    assert.equal(getDeviceKind(undefined), "browser");
    assert.equal(getDeviceLabel("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", traffic), "Tablet");
    assert.equal(getDeviceLabel(undefined, traffic), "Navegador");
});

test("traffic map only receives authenticated logins with valid coordinates", () => {
    const points = getAuthenticatedTrafficMapPoints([
        {
            id: 1,
            action: "auth.login",
            details: {
                user_email: "worker@example.com",
                geo: { city: "Girona", country: "Spain", latitude: 41.98, longitude: 2.82 },
            },
        },
        {
            id: 2,
            action: "public.page_view",
            details: {
                path: "/",
                geo: { city: "Washington", country: "United States", latitude: 38.9, longitude: -77.04 },
            },
        },
        {
            id: 3,
            action: "auth.login",
            details: { user_email: "without-geo@example.com", geo: { latitude: "not-a-number" } },
        },
    ] as never, "Unknown user");

    assert.deepEqual(points, [{
        id: "1",
        lat: 41.98,
        lng: 2.82,
        label: "worker@example.com",
        location: "Girona, Spain",
    }]);
});
