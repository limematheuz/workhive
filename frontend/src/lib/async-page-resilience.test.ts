import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("calendar async read handles rejection and retires stale requests", () => {
    const page = read("../app/dashboard/calendar/page.tsx");
    const hook = read("../hooks/useCalendarWorkspaceData.ts");
    assert.match(page, /useCalendarWorkspaceData\(user\)/);
    assert.match(page, /<CalendarWorkspace key=/);
    assert.match(hook, /catch \(error\)/);
    assert.match(hook, /version !== request.current.version/);
    assert.match(hook, /kind === "denied" \? emptySnapshot\(\)/);
    assert.match(hook, /loading: false, error: kind/);
    assert.match(hook, /TaskService.getAllTaskItems/);
});
