import assert from "node:assert/strict";
import test from "node:test";
import type { TaskItem } from "../types/user";
import { changeStructuredChecklistDraft, projectTaskChecklistEdits, structuredChecklistRows } from "../domain/tasks/task-checklist-edit.ts";

const source = (): TaskItem => ({
    id: 1, title: "Trabajo QA", unit: "servicio", location_id: 1, user_id: null,
    status: "pending", priority: "medium", is_invoiced: false,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    description: "Nota\n- [ ] Mismo título",
    checklist_items: [
        { id: 11, position: 0, source_line_index: 1, text: "Mismo título", completed: false, assignments: [] },
        { id: 22, position: 1, source_line_index: null, text: "Mismo título", completed: false, assignments: [
            { user_id: 7, user_name: "Ana", status: "pending" }, { user_id: 8, user_name: "Luis", status: "pending" },
        ] },
    ],
    checklist_evidence: { item_22: { note: "Conservar", photoUrl: "/media/qa.png", answer: "no" } },
});

test("mixed checklists identify space requirements by stable id even with equal titles", () => {
    assert.deepEqual(structuredChecklistRows(source()).map(item => item.id), [22]);
});

test("answer drafts preserve shared people and evidence without mutating the source", () => {
    const task = source();
    const before = structuredClone(task);
    const view = projectTaskChecklistEdits(task, [{ id: 22, completed: true }]);
    assert.equal(view.checklist_items?.[1].completed, true);
    assert.deepEqual(view.checklist_items?.[1].assignments, before.checklist_items?.[1].assignments);
    assert.deepEqual(view.checklist_evidence?.item_22, { note: "Conservar", photoUrl: "/media/qa.png", answer: "yes" });
    assert.deepEqual(task, before);
    assert.equal(projectTaskChecklistEdits(task, [{ id: 22, completed: false }]).checklist_evidence?.item_22.answer, null);
});

test("reverting answers and assignments removes draft fields rather than clearing other edits", () => {
    const task = source();
    let edits = changeStructuredChecklistDraft(task, [], { id: 22, completed: true });
    edits = changeStructuredChecklistDraft(task, edits, { id: 22, assigned_user_ids: [] });
    assert.deepEqual(edits, [{ id: 22, completed: true, assigned_user_ids: [] }]);
    edits = changeStructuredChecklistDraft(task, edits, { id: 22, completed: false });
    assert.deepEqual(edits, [{ id: 22, assigned_user_ids: [] }]);
    edits = changeStructuredChecklistDraft(task, edits, { id: 22, assigned_user_ids: [8, 7] });
    assert.deepEqual(edits, []);
    assert.deepEqual(changeStructuredChecklistDraft(task, [], { id: 11, completed: true }), []);
});
