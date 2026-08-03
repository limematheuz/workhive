import assert from "node:assert/strict";
import test from "node:test";

import {
    buildGoogleMapsEmbedUrl,
    GOOGLE_MAPS_EMBED_SANDBOX,
} from "./google-maps-embed.ts";

test("buildGoogleMapsEmbedUrl encodes the address query", () => {
    const url = buildGoogleMapsEmbedUrl("Calle Mayor 1, Madrid");
    assert.match(url, /^https:\/\/maps\.google\.com\/maps\?/);
    assert.match(url, /output=embed/);
    assert.match(url, /q=Calle%20Mayor%201%2C%20Madrid/);
});

test("google maps embed allows only the capabilities it requires", () => {
    assert.equal(GOOGLE_MAPS_EMBED_SANDBOX, "allow-scripts allow-same-origin allow-popups");
});
