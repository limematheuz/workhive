import assert from "node:assert/strict";
import test from "node:test";
import { toDateTimeLocal } from "./partner-portal-form.ts";

test("editing a request preserves its instant across winter and summer offsets", () => {
    const previous = process.env.TZ;
    try {
        process.env.TZ = "Europe/Madrid";
        assert.equal(toDateTimeLocal("2026-07-01T10:15:00Z"), "2026-07-01T12:15");
        assert.equal(toDateTimeLocal("2026-01-01T10:15:00Z"), "2026-01-01T11:15");
        for (const value of ["2026-07-01T10:15:00Z", "2026-01-01T10:15:00Z"]) {
            assert.equal(new Date(toDateTimeLocal(value)).getTime(), new Date(value).getTime());
        }
        assert.equal(toDateTimeLocal("invalid"), "");
    } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
    }
});
