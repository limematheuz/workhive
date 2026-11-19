import assert from "node:assert/strict";
import test from "node:test";
import { ApiResponseError } from "./api.ts";
import { overviewResourceFailureState } from "./overview-resource.ts";

test("overview classifies 403 permission and plan boundaries as denied, not load errors", () => {
    assert.equal(
        overviewResourceFailureState(new ApiResponseError("Not in plan", 403, "entitlement.feature_not_in_plan")),
        "denied",
    );
    assert.equal(
        overviewResourceFailureState(new ApiResponseError("Forbidden", 403)),
        "denied",
    );
});

test("overview preserves transient and server failures as load errors", () => {
    assert.equal(overviewResourceFailureState(new ApiResponseError("Unavailable", 503)), "error");
    assert.equal(overviewResourceFailureState(new ApiResponseError("Rate limited", 429)), "error");
    assert.equal(overviewResourceFailureState(new Error("Network error")), "error");
});
