import assert from "node:assert/strict"
import test from "node:test"

import { getLocationNavigationHref, isSafeLocationMapUrl } from "./location-map-url.ts"

test("accepts supported HTTPS map providers", () => {
    assert.equal(isSafeLocationMapUrl("https://www.google.com/maps?q=Madrid"), true)
    assert.equal(isSafeLocationMapUrl("https://maps.app.goo.gl/example"), true)
    assert.equal(isSafeLocationMapUrl("https://waze.com/ul?ll=1,2"), true)
})

test("rejects unsafe and unsupported map URLs", () => {
    assert.equal(isSafeLocationMapUrl("javascript:alert(1)"), false)
    assert.equal(isSafeLocationMapUrl("http://www.google.com/maps"), false)
    assert.equal(isSafeLocationMapUrl("https://attacker.example/maps"), false)
    assert.equal(isSafeLocationMapUrl("not a URL"), false)
})


test("navigation is unavailable without actual location data", () => {
    assert.equal(getLocationNavigationHref(null), null);
    assert.equal(getLocationNavigationHref({}), null);
    assert.equal(getLocationNavigationHref({ address: "  ", city: " " }), null);
});
test("navigation keeps valid custom map links", () => {
    assert.equal(getLocationNavigationHref({ map_url: "https://waze.com/ul?ll=0,0" }), "https://waze.com/ul?ll=0,0");
});
test("navigation includes zero and boundary coordinates", () => {
    for (const [latitude, longitude] of [[0, 0], [0, -3], [40, 0], [-90, 180]]) {
        const href = getLocationNavigationHref({ latitude, longitude });
        assert.ok(href);
        assert.equal(new URL(href).searchParams.get("query"), `${latitude},${longitude}`);
    }
});
test("navigation encodes a known address without inventing an empty destination", () => {
    const href = getLocationNavigationHref({ address: " Calle QA & 1 ", city: " Madrid " });
    assert.ok(href);
    assert.equal(new URL(href).searchParams.get("query"), "Calle QA & 1, Madrid");
    assert.equal(new URL(getLocationNavigationHref({ city: "Madrid" })!).searchParams.get("query"), "Madrid");
});
test("invalid coordinates use a real address or disable navigation", () => {
    for (const latitude of [NaN, Infinity, 91]) {
        assert.equal(getLocationNavigationHref({ latitude, longitude: 2 }), null);
        assert.equal(new URL(getLocationNavigationHref({ latitude, longitude: 2, address: "QA" })!).searchParams.get("query"), "QA");
    }
    assert.equal(getLocationNavigationHref({ latitude: 40, longitude: 181 }), null);
});
test("unsafe custom URLs cannot become navigation links", () => {
    assert.equal(getLocationNavigationHref({ map_url: "javascript:alert(1)" }), null);
    assert.equal(new URL(getLocationNavigationHref({ map_url: "https://attacker.example", address: "QA" })!).hostname, "www.google.com");
});
