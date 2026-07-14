import assert from "node:assert/strict";
import test from "node:test";

import {
    buildGoogleMapsEmbedUrl,
    shouldSandboxGoogleMapsEmbed,
} from "./google-maps-embed.ts";

test("buildGoogleMapsEmbedUrl encodes the address query", () => {
    const url = buildGoogleMapsEmbedUrl("Calle Mayor 1, Madrid");
    assert.match(url, /^https:\/\/maps\.google\.com\/maps\?/);
    assert.match(url, /output=embed/);
    assert.match(url, /q=Calle%20Mayor%201%2C%20Madrid/);
});

test("google maps embed is not sandboxed to avoid cross-frame SecurityError", () => {
    assert.equal(shouldSandboxGoogleMapsEmbed(), false);
});
