import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ApiResponseError } from "./api.ts";
import { getUserDeletionErrorMessage } from "./user-deletion.ts";

const copy = {
    blocked: "Suspend access to preserve history",
    fallback: "Could not delete user",
};

test("user deletion translates a related-data conflict into actionable copy", () => {
    const error = new ApiResponseError(
        "Server fallback",
        409,
        "USER_HAS_RELATED_DATA",
    );

    assert.equal(getUserDeletionErrorMessage(error, copy), copy.blocked);
});

test("user deletion keeps safe specific errors and a generic fallback", () => {
    assert.equal(
        getUserDeletionErrorMessage(new Error("Not enough permissions"), copy),
        "Not enough permissions",
    );
    assert.equal(getUserDeletionErrorMessage(null, copy), copy.fallback);
});

test("user deletion service uses centralized response handling", () => {
    const service = readFileSync(
        new URL("../services/user.service.ts", import.meta.url),
        "utf8",
    );
    assert.match(service, /deleteUser:[\s\S]*assertApiResponseOk/);
    assert.doesNotMatch(service, /errData\.detail \|\| "Error deleting user"/);
});
