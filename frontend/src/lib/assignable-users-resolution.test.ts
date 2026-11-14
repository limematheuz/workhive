import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("operational tasks and calendar pages load assignable company workers via /users/assignable", () => {
    const userService = read("../services/user.service.ts");
    const tasksHook = read("../hooks/useTasksPage.ts");
    const calendarPage = read("../app/dashboard/calendar/page.tsx");

    assert.match(userService, /getAssignableUsers/);
    assert.match(userService, /\/api\/v1\/users\/assignable/);
    assert.match(tasksHook, /UserService\.getAssignableUsers/);
    assert.match(calendarPage, /UserService\.getAssignableUsers/);
    assert.match(tasksHook, /task\.assignments/);
    assert.match(tasksHook, /checklist_items/);
});
