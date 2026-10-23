import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ApiResponseError } from "./api.ts";
import { getTaskDeletionErrorMessage } from "./task-deletion.ts";

const copy = {
    blocked_recorded_work: "Keep recorded work linked to its reservation",
    not_found: "Task unavailable or access denied",
    error: "Could not delete the task",
};

test("task deletion explains a recorded-work conflict", () => {
    const error = new ApiResponseError(
        "Recorded work must remain linked to its reservation.",
        409,
        "RESERVATION_TASK_HAS_RECORDED_WORK",
    );

    assert.equal(getTaskDeletionErrorMessage(error, copy), copy.blocked_recorded_work);
});

test("task deletion preserves other errors and uses a safe fallback", () => {
    assert.equal(
        getTaskDeletionErrorMessage(new Error("Not enough permissions"), copy),
        "Not enough permissions",
    );
    assert.equal(getTaskDeletionErrorMessage(null, copy), copy.error);
});

test("task deletion does not present a missing or inaccessible task as deleted", () => {
    const error = new ApiResponseError("Task Item not found", 404);
    assert.equal(getTaskDeletionErrorMessage(error, copy), copy.not_found);
});

test("both task deletion entry points show the same feedback", () => {
    for (const path of ["../hooks/useTaskCrud.ts", "../hooks/useOperationsCalendar.ts"]) {
        const hook = readFileSync(new URL(path, import.meta.url), "utf8");
        assert.match(hook, /getTaskDeletionErrorMessage\(error, dict\.tasks\.delete_confirm_dialog\)/);
    }
});

test("task deletion service preserves structured conflict codes", () => {
    const service = readFileSync(
        new URL("../services/task.service.ts", import.meta.url),
        "utf8",
    );
    assert.match(service, /deleteTaskItem:[\s\S]*assertApiResponseOk\(response, "Error deleting task item"\)/);
    assert.doesNotMatch(service, /deleteTaskItem:[\s\S]*if \(response\.status === 404\)/);
});
