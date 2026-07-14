import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("task edit actions hide close and block duplicate when invoiced", () => {
    const actions = read("../components/tasks/TaskEditFormActions.tsx");
    const form = read("../components/tasks/TaskEditForm.tsx");
    const permissions = read("../domain/tasks/task-permissions.ts");
    const crud = read("../hooks/useTaskCrud.ts");

    assert.match(permissions, /export function canDuplicateTask/);
    assert.match(actions, /canDuplicateTask/);
    assert.doesNotMatch(actions, /close_btn|onClose/);
    assert.match(form, /canDuplicateTask|immutable/);
    assert.match(crud, /canDuplicateTask/);
    assert.match(crud, /is_invoiced/);
});

test("task edit modal keeps a denser report-like chrome without footer close", () => {
    const modal = read("../components/tasks/TaskEditModal.tsx");
    const actions = read("../components/tasks/TaskEditFormActions.tsx");

    assert.match(modal, /rounded-2xl|rounded-\[28px\]|DialogContent/);
    assert.match(modal, /scrollbar-width:none|overflow-y-auto/);
    assert.match(actions, /reportPrimaryBtn|btn-primary|bg-accent/);
    assert.doesNotMatch(actions, /dict\.tasks\.dialog\.close_btn/);
});
