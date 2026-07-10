import assert from "node:assert/strict";
import test from "node:test";

import {
    assignTaskChecklistItem,
    isTaskChecklistFullyDistributed,
    parseTaskChecklist,
    toggleTaskChecklistItem,
} from "./task-checklist.ts";

test("task checklist parsing preserves completion and assignment metadata", () => {
    const items = parseTaskChecklist(
        "- [ ] Cocina (@12:Ana Pérez)\n- [x] Baño (@13:Luis)\nNota libre"
    );

    assert.equal(items.length, 2);
    assert.deepEqual(items[0], {
        text: "Cocina",
        checked: false,
        assignedUserId: 12,
        assignedUserName: "Ana Pérez",
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
