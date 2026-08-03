import assert from "node:assert/strict"
import test from "node:test"

import { isSafeLocationMapUrl } from "./location-map-url.ts"

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
