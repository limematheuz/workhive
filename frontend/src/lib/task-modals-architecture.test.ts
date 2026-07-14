import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canDuplicateTask } from "../domain/tasks/task-permissions.ts";
import { resolveTaskEditChecklist } from "./resolve-task-edit-checklist.ts";
import {
    assignTaskChecklistItem,
    toggleTaskChecklistItem,
} from "./task-checklist.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("task dialogs share glass chrome and keep compact checklist controls", () => {
    const chrome = read("../components/tasks/taskDialogChrome.ts");
    const editModal = read("../components/tasks/TaskEditModal.tsx");
    const createModal = read("../components/tasks/TaskCreateModal.tsx");
    const templateModal = read("../components/tasks/TemplateModal.tsx");
    const requestReview = read("../components/tasks/TaskRequestReview.tsx");
    const checklistEditor = read("../components/tasks/TaskChecklistEditor.tsx");
    const globals = read("../app/globals.css");

    assert.match(chrome, /taskDialogContentClass/);
    assert.match(chrome, /dialog-glass/);
    assert.match(editModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(createModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(templateModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(requestReview, /taskDialogFooterClass|taskDialogChrome/);
    assert.match(checklistEditor, /dialog-compact-control/);
    assert.match(globals, /dialog-compact-control/);
    assert.match(globals, /dialog-glass/);
    assert.match(globals, /46%|52%/);
});

test("resolveTaskEditChecklist keeps interactive markdown and structured fallbacks", () => {
    const markdown = resolveTaskEditChecklist(
        "Intro\n- [ ] Cocina (@7:Ana)\n- [x] Baño",
    );
    assert.deepEqual(
        markdown.map((item) => ({ text: item.text, checked: item.checked, assignedUserId: item.assignedUserId })),
        [
            { text: "Cocina", checked: false, assignedUserId: 7 },
            { text: "Baño", checked: true, assignedUserId: undefined },
        ],
    );

    const structured = resolveTaskEditChecklist("", {
        checklist_items: [
            {
                id: 11,
                position: 0,
                text: "Suelo",
                completed: false,
                assignments: [{ user_id: 3, user_name: "Luis", status: "pending" }],
            },
            {
                id: 12,
                position: 1,
                text: "Cocina",
                completed: true,
                assignments: [],
            },
        ],
    });
    assert.equal(structured.length, 2);
    assert.equal(structured[0].text, "Suelo");
    assert.equal(structured[0].assignedUserId, 3);
    assert.equal(structured[1].checked, true);
});

test("modal checklist helpers round-trip toggle and assign like the edit form", () => {
    const source =
        "Intro line\n- [ ] Cocina\n- [ ] Bano\n- [ ] Terraza";
    const resolved = resolveTaskEditChecklist(source);
    assert.equal(resolved.length, 3);
    assert.deepEqual(
        resolved.map((item) => item.text),
        ["Cocina", "Bano", "Terraza"],
    );

    const afterToggle = toggleTaskChecklistItem(source, resolved[0].index);
    assert.match(afterToggle, /- \[x\] Cocina/);
    assert.match(afterToggle, /- \[ \] Bano/);

    const afterAssign = assignTaskChecklistItem(afterToggle, resolved[1].index, "42", "Maria");
    assert.match(afterAssign, /- \[ \] Bano \(@42:Maria\)/);
    assert.match(afterAssign, /- \[x\] Cocina/);
    assert.match(afterAssign, /- \[ \] Terraza/);

    const finalItems = resolveTaskEditChecklist(afterAssign);
    assert.equal(finalItems[0].checked, true);
    assert.equal(finalItems[1].assignedUserId, 42);
    assert.equal(finalItems[1].assignedUserName, "Maria");
    assert.equal(finalItems[2].checked, false);
    assert.equal(finalItems[2].assignedUserId, undefined);
});

test("modal permissions block duplicate when invoiced and allow managers otherwise", () => {
    const manager = {
        id: 1,
        email: "admin@test.com",
        full_name: "Admin",
        role: { id: 1, name: "admin" },
        company_id: 1,
        is_active: true,
    } as const;

    assert.equal(canDuplicateTask(manager as never, { is_invoiced: false }), true);
    assert.equal(canDuplicateTask(manager as never, { is_invoiced: true }), false);
    assert.equal(canDuplicateTask(null, { is_invoiced: false }), false);
});

test("task edit form keeps checklist editor wiring and sticky glass footer actions", () => {
    const fields = read("../components/tasks/TaskEditFormFields.tsx");
    const form = read("../components/tasks/TaskEditForm.tsx");
    const actions = read("../components/tasks/TaskEditFormActions.tsx");

    assert.match(fields, /resolveTaskEditChecklist|resolve-task-edit-checklist/);
    assert.match(fields, /TaskChecklistEditor/);
    assert.match(form, /overflow-y-auto/);
    assert.match(actions, /canDuplicateTask/);
    assert.match(actions, /taskDialogPrimaryBtnClass|btn-primary/);
    assert.doesNotMatch(actions, /dict\.tasks\.dialog\.close_btn/);
});
