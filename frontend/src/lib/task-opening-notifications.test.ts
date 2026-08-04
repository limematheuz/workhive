import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("opening a task from every operational entry point dismisses its alert", () => {
    const operationsCalendar = read("../hooks/useOperationsCalendar.ts");
    const taskCrud = read("../hooks/useTaskCrud.ts");
    const techDashboard = read("../components/dashboard/TechDashboard.tsx");

    for (const source of [operationsCalendar, taskCrud, techDashboard]) {
        assert.match(source, /dismissTaskNotification/);
        assert.match(source, /dismissTaskNotification\(currentUser\.id, task\)/);
    }
});
