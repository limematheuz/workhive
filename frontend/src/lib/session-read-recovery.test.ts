import assert from "node:assert/strict";
import test from "node:test";
import { ApiResponseError } from "./api.ts";
import { mayRecoverCachedSession } from "./session-read-recovery.ts";

test("prepared worker sessions survive transport failure even when the browser reports online", () => {
    for (const error of [new TypeError("Failed to fetch"), new Error("Timeout"), new ApiResponseError("Unavailable", 503)]) {
        assert.equal(mayRecoverCachedSession(error, "/worker", true), true);
        assert.equal(mayRecoverCachedSession(error, "/worker/jobs", true), true);
        assert.equal(mayRecoverCachedSession(error, "/dashboard", true), false);
        assert.equal(mayRecoverCachedSession(error, "/worker-other", true), false);
    }
});

test("offline cache never replaces an explicit authentication, subscription or access denial", () => {
    for (const status of [400, 401, 402, 403, 404, 422]) {
        for (const online of [true, false]) {
            assert.equal(mayRecoverCachedSession(new ApiResponseError("Denied", status), "/worker", online), false);
        }
    }
});
