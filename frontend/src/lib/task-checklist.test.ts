import assert from "node:assert/strict";
import test from "node:test";

import {
    assignTaskChecklistItem,
    isTaskChecklistFullyDistributed,
    parseTaskChecklist,
    toggleTaskChecklistItem,
    resetTaskChecklistProgress,
} from "./task-checklist.ts";

test("new work clears answers and worker progress while preserving instructions and distribution", () => {
    const description = "<!-- workhive_assignees:7,8 -->\nNota libre\n- [x] Cocina (@7:Ana:completed)\n* [X] Baño (@8:Luis:progress)\n- [ ] Puerta (@7:Ana:review)\n- [x] Cristales (@8:Luis)";
    assert.equal(resetTaskChecklistProgress(description), "<!-- workhive_assignees:7,8 -->\nNota libre\n- [ ] Cocina (@7:Ana:pending)\n* [ ] Baño (@8:Luis:pending)\n- [ ] Puerta (@7:Ana:pending)\n- [ ] Cristales (@8:Luis)");
    assert.ok(description.includes("[x] Cocina"));
});

test("new work leaves non-checklist content intact and handles absent instructions", () => {
    assert.equal(resetTaskChecklistProgress(null), null);
    assert.equal(resetTaskChecklistProgress(undefined), null);
    assert.equal(resetTaskChecklistProgress(""), null);
    assert.equal(resetTaskChecklistProgress("Texto (completed)\n<!-- categorías: Cocina -->"), "Texto (completed)\n<!-- categorías: Cocina -->");
});

test("all recorded assignment statuses reset to pending, including unchecked completed assignments", () => {
    for (const status of ["pending", "accepted", "rejected", "progress", "completed", "review"]) {
        assert.equal(resetTaskChecklistProgress(`- [ ] Revisar (@7:Ana Pérez:${status})`), "- [ ] Revisar (@7:Ana Pérez:pending)");
    }
});

test("task checklist parsing preserves completion and assignment metadata", () => {
    const items = parseTaskChecklist(
        "- [ ] Cocina (@12:Ana Pérez:completed)\n- [x] Baño (@13:Luis)\nNota libre"
    );

    assert.equal(items.length, 2);
    assert.deepEqual(items[0], {
        text: "Cocina",
        checked: false,
        assignedUserId: 12,
        assignedUserName: "Ana Pérez",
        assignedStatus: "completed",
        index: 0,
    });
    assert.equal(items[1].checked, true);
    assert.equal(isTaskChecklistFullyDistributed(items), true);
});

test("task checklist updates completion and assignments without touching other lines", () => {
    const description = "- [ ] Cocina\nNota libre";
    const checked = toggleTaskChecklistItem(description, 0);
    assert.equal(checked, "- [x] Cocina\nNota libre");

    const assigned = assignTaskChecklistItem(checked, 0, "7", "Marta");
    assert.equal(assigned, "- [x] Cocina (@7:Marta)\nNota libre");

    const unassigned = assignTaskChecklistItem(
        assigned,
        0,
        "unassigned"
    );
    assert.equal(unassigned, "- [x] Cocina\nNota libre");
});
