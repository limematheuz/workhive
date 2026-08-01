import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
    readFileSync(new URL(relativePath, import.meta.url), "utf8");

for (const relativePath of [
    "../hooks/useLocationTasksSheet.ts",
    "../hooks/useTaskCrud.ts",
    "../hooks/useOperationsCalendar.ts",
]) {
    test(`${relativePath} guards incomplete checklists before completion`, () => {
        const hook = read(relativePath);
        assert.match(hook, /canMarkTaskCompleted/);
        assert.match(hook, /error_checklist_incomplete/);
    });
}

test("calendar error handling does not write business failures to the console", () => {
    const hook = read("../hooks/useOperationsCalendar.ts");
    assert.doesNotMatch(
        hook,
        /catch \(error\) \{\s*console\.error\("Error updating task status"/,
    );
});
