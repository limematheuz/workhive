import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("tasks page exposes loadError and retry instead of falling back to a false empty board", () => {
    const hook = read("../hooks/useTasksPage.ts");
    const page = read("../app/dashboard/tasks/page.tsx");

    assert.match(hook, /const \[loadError, setLoadError\]/);
    assert.match(hook, /isAccessDeniedError/);
    assert.match(hook, /setLoadError\(denied \? "denied" : "unavailable"\)/);
    assert.match(hook, /dict\.tasks\?\.error_denied/);
    assert.match(hook, /dict\.tasks\?\.error_load/);
    assert.doesNotMatch(hook, /error_update/);
    assert.match(hook, /retryLoad/);
    assert.match(page, /state\.loadError/);
    assert.match(page, /state\.loadErrorMessage/);
    assert.match(page, /state\.retryLoad/);
});

test("task edit modal wires setEditUserId through form fields so task assignee is editable", () => {
    const modals = read("../components/tasks/TaskFormModals.tsx");
    const calendar = read("../components/dashboard/OperationsCalendar.tsx");
    const editModal = read("../components/tasks/TaskEditModal.tsx");
    const editForm = read("../components/tasks/TaskEditForm.tsx");
    const fields = read("../components/tasks/TaskEditFormFields.tsx");

    assert.match(modals, /setEditUserId=\{setEditUserId\}/);
    assert.match(calendar, /setEditUserId=\{state\.setEditUserId\}/);
    assert.match(editModal, /setEditUserId/);
    assert.match(editForm, /setEditUserId/);
    assert.match(fields, /task-edit-assignee/);
    assert.match(fields, /from "@\/components\/ui\/select"/);
});
