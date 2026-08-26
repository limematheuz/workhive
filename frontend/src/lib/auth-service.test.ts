import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("getMe preserves an unauthenticated response for invitation flows", () => {
    const source = readFileSync(
        new URL("../services/auth.service.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /import \{ apiFetch, assertApiResponseOk/);
    assert.match(source, /await assertApiResponseOk\(response, "Failed to fetch user profile"\)/);
});
