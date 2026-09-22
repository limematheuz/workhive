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
    assert.match(chrome, /dialog-glass-overlay/);
    assert.match(editModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(createModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(templateModal, /taskDialogContentClass|taskDialogChrome/);
    assert.match(requestReview, /taskDialogFooterClass|taskDialogChrome/);
    assert.match(checklistEditor, /from "@\/components\/ui\/select"/);
    assert.match(checklistEditor, /<SelectTrigger aria-label="Asignar todos los pasos"/);
    assert.doesNotMatch(checklistEditor, /<select|appearance-none|ChevronDown/);
    assert.doesNotMatch(checklistEditor, /UserRound/);
    assert.match(globals, /dialog-compact-control/);
    assert.match(globals, /dialog-glass/);
    assert.match(globals, /\[data-slot="dialog-close"\]/);
    assert.match(globals, /0\.55|rgba\(34,\s*34,\s*34,\s*0\.55\)/);
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
    assert.match(fields, /title_label/);
    assert.match(fields, /onAssignAll/);
    assert.doesNotMatch(fields, /calendarAssigneeName/);
});

test("tasks page forwards pricing state required by the task edit modal", () => {
    const tasksPage = read("../hooks/useTasksPage.ts");
    const formModals = read("../components/tasks/TaskFormModals.tsx");

    assert.match(formModals, /editPricingMode: TaskPricingMode/);
    assert.match(formModals, /setEditPricingMode: \(val: TaskPricingMode\) => void/);
    assert.match(tasksPage, /editPricingMode: crud\.editPricingMode/);
    assert.match(tasksPage, /setEditPricingMode: crud\.setEditPricingMode/);
});

test("task creation exposes compact per-job pricing controls and keeps defaults in the domain helper", () => {
    const createList = read("../components/tasks/TaskCreateHouseTemplateList.tsx");
    const crud = read("../hooks/useTaskCrud.ts");
    const tasksPage = read("../hooks/useTasksPage.ts");

    assert.match(createList, /taskPricingOverrides/);
    assert.match(createList, /selectedHouseTemplateId: number \| null/);
    assert.match(createList, /role="radiogroup"/);
    assert.match(createList, /role="radio"/);
    assert.match(createList, /aria-checked=\{isChecked\}/);
    assert.match(createList, /pricingValuesForTaskCreation/);
    assert.match(createList, /\["fixed", "hourly"\] as const/);
    assert.match(createList, /aria-pressed=\{active\}/);
    assert.match(createList, /dialog-compact-control/);
    assert.match(createList, /flex items-end gap-2 md:ml-auto/);
    assert.match(createList, /data-price-input/);
    assert.match(crud, /resolveTaskCreationPricing/);
    assert.match(crud, /pricing_mode: effective\.pricingMode/);
    assert.match(tasksPage, /taskPricingOverrides: crud\.taskPricingOverrides/);
    assert.match(tasksPage, /setTaskPricingOverrides: crud\.setTaskPricingOverrides/);
});

test("task creation selects and creates exactly one location service", () => {
    const crud = read("../hooks/useTaskCrud.ts");
    const createList = read("../components/tasks/TaskCreateHouseTemplateList.tsx");

    assert.match(crud, /selectedId: number \| null/);
    assert.match(crud, /selectedId: data\[0\]\?\.template_task_id \?\? null/);
    assert.match(crud, /const selectHouseTemplate = \(id: number\)/);
    assert.match(crud, /selectedId: id/);
    assert.match(crud, /await TaskService\.createTaskItem\(/);
    assert.doesNotMatch(crud, /Promise\.all\(promises\)/);
    assert.match(createList, /role="radiogroup"/);
    assert.match(createList, /role="radio"/);
    assert.match(createList, /aria-checked=\{isChecked\}/);
});

test("monetary inputs keep numeric validation without native increment buttons", () => {
    const globals = read("../app/globals.css");
    const priceInputs = [
        "../components/tasks/TaskCreateHouseTemplateList.tsx",
        "../components/tasks/TaskEditPricingSection.tsx",
        "../components/tasks/TemplateModal.tsx",
        "../components/tasks/TaskCreateHouseChecklistSection.tsx",
        "../components/locations/LocationTemplatesTab.tsx",
        "../components/locations/LocationHistoryTab.tsx",
        "../components/quotes/QuoteItemsTable.tsx",
        "../components/invoices/InvoiceConceptsTable.tsx",
        "../components/invoices/InvoiceDetailItemsSection.tsx",
        "../components/expenses/ExpenseFormDialog.tsx",
    ];

    assert.match(globals, /input\[type="number"\]::-webkit-inner-spin-button/);
    assert.match(globals, /-moz-appearance: textfield/);
    for (const path of priceInputs) {
        assert.match(read(path), /data-price-input/);
    }

    const invoiceDetailItems = read("../components/invoices/InvoiceDetailItemsSection.tsx");
    assert.match(invoiceDetailItems, /data-price-input\s+aria-label=\{dict\.invoices\.price\}/);
    assert.doesNotMatch(invoiceDetailItems, /data-price-input\s+aria-label=\{dict\.invoices\.col_qty\}/);

    const createList = read("../components/tasks/TaskCreateHouseTemplateList.tsx");
    assert.match(createList, /type="text"\s+inputMode="decimal"/);
});

test("location history uses shared form controls", () => {
    const history = read("../components/locations/LocationHistoryTab.tsx");

    assert.match(history, /from "@\/components\/ui\/input"/);
    assert.match(history, /from "@\/components\/ui\/select"/);
    assert.match(history, /<SelectTrigger aria-label="Asignar a un trabajador de tu equipo"/);
    assert.match(history, /<SelectTrigger aria-label="Filtrar por estado"/);
    assert.doesNotMatch(history, /<select|<input/);
    assert.doesNotMatch(history, /bg-black|hover:bg-neutral-800/);
});
