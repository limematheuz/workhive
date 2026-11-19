import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendarPageSource = readFileSync(
    new URL("../app/dashboard/calendar/page.tsx", import.meta.url),
    "utf8",
);

test("calendar loads the complete authorized schedule and exposes recoverable failures", () => {
    assert.match(calendarPageSource, /TaskService\.getAllTaskItems\(\)/);
    assert.doesNotMatch(calendarPageSource, /getTaskItems\(\{ limit: 500|UserService\.getUsers/);
    assert.match(calendarPageSource, /try \{[\s\S]+catch \(cause\)/);
    assert.match(calendarPageSource, /currentScope\.current !== scope/);
    assert.match(calendarPageSource, /data\?\.scope === scope/);
    assert.match(calendarPageSource, /role="alert"[\s\S]+Reintentar/);
    assert.match(calendarPageSource, /role="status"[\s\S]+Cargando todos los trabajos/);
});
