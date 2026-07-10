import assert from "node:assert/strict";
import test from "node:test";

import { buildExternalTaskOperationalUpdate } from "./external-task-update.ts";

test("receiver company can save external checklist assignments and status", () => {
    const payload = buildExternalTaskOperationalUpdate({
        description: "- [ ] Kitchen (@7:viewer:accepted)",
        scheduledStartAt: "2026-06-22T11:00:00.000Z",
        status: "progress",
        dateDone: null,
    });

    assert.equal(payload.description, "- [ ] Kitchen (@7:viewer:accepted)");
    assert.equal(payload.status, "progress");
    assert.equal(payload.date_done, null);
    assert.equal(payload.scheduled_start_at, "2026-06-22T11:00:00.000Z");
    assert.deepEqual(Object.keys(payload).sort(), [
        "date_done",
        "description",
        "scheduled_start_at",
        "status",
    ]);
});
