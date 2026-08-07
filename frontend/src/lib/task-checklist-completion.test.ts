import assert from "node:assert/strict";
import test from "node:test";

import {
    canMarkTaskCompleted,
    getTaskChecklistProgress,
    isTaskChecklistComplete,
    taskHasChecklist,
} from "./task-checklist-completion.ts";

test("tasks without checklist can be completed", () => {
    const task = { description: "Solo notas", checklist_items: [] };
    assert.equal(taskHasChecklist(task), false);
    assert.equal(canMarkTaskCompleted(task), true);
});

test("relational checklist blocks completion until every item is done", () => {
    const incomplete = {
        description: "",
        checklist_items: [
            { id: 1, position: 1, text: "Cama", completed: true, assignments: [] },
            { id: 2, position: 2, text: "Baño", completed: false, assignments: [] },
        ],
    };
    assert.equal(taskHasChecklist(incomplete), true);
    assert.equal(isTaskChecklistComplete(incomplete), false);
    assert.equal(canMarkTaskCompleted(incomplete), false);

    const complete = {
        ...incomplete,
        checklist_items: incomplete.checklist_items.map((item) => ({
            ...item,
            completed: true,
        })),
    };
    assert.equal(canMarkTaskCompleted(complete), true);
});

test("parsed checklist uses evidence answers like the backend", () => {
    const task = {
        description: "- [ ] Cama\n- [ ] Baño",
        checklist_evidence: {
            parsed_1: { answer: "yes" as const },
        },
    };
    assert.equal(taskHasChecklist(task), true);
    assert.equal(canMarkTaskCompleted(task), false);

    const answered = {
        ...task,
        checklist_evidence: {
            parsed_1: { answer: "yes" as const },
            parsed_2: { answer: "no" as const },
        },
    };
    assert.equal(canMarkTaskCompleted(answered), true);
});

test("parsed checklist accepts completed worker assignments like the backend", () => {
    assert.equal(
        canMarkTaskCompleted({
            description: "- [ ] Cocina (@12:Ana Pérez:completed)\n- [ ] Baño (@13:Luis:completed)",
        }),
        true,
    );
    assert.equal(
        canMarkTaskCompleted({
            description: "- [ ] Cocina (@12:Ana Pérez:progress)",
        }),
        false,
    );
});

test("checklist progress counts no answers as resolved requirements", () => {
    assert.deepEqual(
        getTaskChecklistProgress({
            description: "- [ ] Cocina\n- [ ] Baño",
            checklist_evidence: {
                parsed_1: { answer: "yes" },
                parsed_2: { answer: "no" },
            },
        }),
        { completed: 2, total: 2 },
    );
});

test("structured checklist honours recorded legacy answers until rows are repaired", () => {
    const task = {
        description: "- [ ] Cocina\n- [ ] Baño",
        checklist_items: [
            { id: 41, completed: false },
            { id: 42, completed: false },
        ],
        checklist_evidence: {
            item_41: { answer: "yes" as const },
            item_42: { answer: "no" as const },
        },
    };

    assert.deepEqual(getTaskChecklistProgress(task), { completed: 2, total: 2 });
    assert.equal(isTaskChecklistComplete(task), true);
});
