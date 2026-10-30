import assert from "node:assert/strict";
import test from "node:test";
import { filterTasksForKanban } from "../domain/tasks/task-kanban-filter.ts";

const task = (id: number, overrides = {}) => ({
    id, title: "Revisión QA", status: "pending", user_id: 1 as number | null, location_id: 15,
    description: "Instrucciones visibles", notes: "Acceso lateral", is_invoiced: false,
    assignments: [] as { user_id: number; source?: string }[], ...overrides,
});
const all = { query: "", userId: "ALL", locationId: "ALL" };

test("board includes primary, direct and checklist assignees", () => {
    const tasks = [task(1), task(2, { assignments: [{ user_id: 2, source: "direct" }] }),
        task(3, { user_id: null, assignments: [{ user_id: 2, source: "checklist" }] }), task(4, { user_id: null })];
    assert.deepEqual(filterTasksForKanban(tasks, { ...all, userId: "2" }).map(item => item.id), [2, 3]);
    assert.deepEqual(filterTasksForKanban(tasks, { ...all, userId: "1" }).map(item => item.id), [1, 2]);
    assert.deepEqual(filterTasksForKanban(tasks, { ...all, userId: "invalid" }), []);
});

test("board combines person and location without losing shared tasks", () => {
    const tasks = [task(1, { assignments: [{ user_id: 2 }] }), task(2, { user_id: 2, location_id: 16 }), task(3)];
    assert.deepEqual(filterTasksForKanban(tasks, { ...all, userId: "2", locationId: "15" }).map(item => item.id), [1]);
    assert.deepEqual(filterTasksForKanban(tasks, { ...all, locationId: "invalid" }), []);
});

test("board search trims spaces, ignores case and preserves visible notes", () => {
    const original = task(1);
    for (const query of ["  REVISIÓN qa  ", " instrucciones VISIBLES ", " ACCESO LATERAL ", "   "]) {
        assert.deepEqual(filterTasksForKanban([original], { ...all, query }), [original]);
    }
});

test("board search excludes hidden metadata and preserves original task objects", () => {
    const original = task(1, { description: "<!-- workhive_assignees:98765 -->\n- [ ] Revisar puerta (@98765:MetadataOculta:pending)" });
    const before = structuredClone(original);
    for (const query of ["MetadataOculta", "workhive_assignees", "98765"]) {
        assert.deepEqual(filterTasksForKanban([original], { ...all, query }), []);
    }
    assert.equal(filterTasksForKanban([original], { ...all, query: "revisar puerta" })[0], original);
    assert.deepEqual(original, before);
});

test("board keeps billing and request exclusions while retaining operational states", () => {
    const tasks = [task(1), task(2, { status: "requested" }), task(3, { status: "rejected" }),
        task(4, { is_invoiced: true }), task(5, { status: "accepted" }), task(6, { status: "progress" }),
        task(7, { status: "review" }), task(8, { status: "completed" })];
    assert.deepEqual(filterTasksForKanban(tasks, all).map(item => item.id), [1, 5, 6, 7, 8]);
});
