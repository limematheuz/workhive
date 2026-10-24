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
    const form = read("../components/tasks/TaskEditForm.tsx");
    const chrome = read("../components/tasks/taskDialogChrome.ts");

    assert.match(modal, /taskDialogContentClass|dialog-glass/);
    assert.match(modal, /DialogContent/);
    assert.match(form, /overflow-y-auto/);
    assert.match(chrome, /dialog-glass|taskDialogPrimaryBtnClass/);
    assert.match(actions, /from "@\/components\/ui\/button"/);
    assert.match(actions, /<Button/);
    assert.doesNotMatch(actions, /<button\b/);
    assert.doesNotMatch(actions, /dict\.tasks\.dialog\.close_btn/);
});

test("historical tasks can update their metadata without being blocked by their original date", () => {
    const crud = read("../hooks/useTaskCrud.ts");
    const calendar = read("../hooks/useOperationsCalendar.ts");
    const editHandler = crud.slice(
        crud.indexOf("const handleSaveTaskDetails"),
        crud.indexOf("const handleDeleteTask"),
    );
    const calendarEditHandler = calendar.slice(
        calendar.indexOf("const handleSaveTaskDetails"),
        calendar.indexOf("const handleDeleteTask"),
    );
    const createHandler = crud.slice(
        crud.indexOf("const handleCreateTask"),
        crud.indexOf("const handleLinkHouseTemplate"),
    );

    assert.match(editHandler, /isTaskPlanningDateChangeToPast/);
    assert.match(calendarEditHandler, /isTaskPlanningDateChangeToPast/);
    assert.match(createHandler, /isTaskPlanningDateBeforeToday/);
});
